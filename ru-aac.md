# mind-mem: как это использовать (для AAC)

Документ под конкретную установку на `aachibilyaev.com`. Всё проверено на этой
машине 2026-09-12. Где документация проекта расходится с фактом — отмечено.

---

## 0. Главное: у тебя УЖЕ две памяти, и они не знают друг о друге

Это корень путаницы, поэтому с этого и начнём.

```
┌─────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  НАТИВНАЯ АВТО-ПАМЯТЬ CLAUDE CODE   │   │             MIND-MEM                 │
│  ~/.claude/projects/-home-aac/      │   │  ~/.mind-mem/workspace/              │
│         memory/                     │   │                                      │
│                                     │   │                                      │
│  53 заметки: MEMORY.md + типы       │   │  123 блока (111 из твоего vault)     │
│  user / feedback / project /        │   │  + аудит-цепочка + governance        │
│  reference                          │   │                                      │
│                                     │   │                                      │
│  ✅ грузится в контекст САМА        │   │  ❌ надо позвать (recall/context)    │
│  ✅ пишется САМА по ходу диалога    │   │  ❌ пишется только через approve     │
│  ❌ видит только Claude Code        │   │  ✅ видят все 18 MCP-клиентов        │
│  ❌ нет противоречий/аудита         │   │  ✅ contradictions + hash chain      │
│  ❌ нет ранжирования (грузится вся) │   │  ✅ BM25F+вектор+RRF+graph-boost     │
│  ❌ нет отката                      │   │  ✅ rollback_proposal                │
└─────────────────┬───────────────────┘   └───────────────────┬──────────────────┘
                  │                                           │
                  │   mm import --from agentmem <dir>         │
                  └──────────────────────────────────────────►│
                            53/53 блока парсятся чисто
                            (проверено dry-run'ом)
```

**Размен ровно такой:** нативная память удобнее (сама грузится, сама пишется),
mind-mem надёжнее (ранжирование, противоречия, аудит, доступ из Codex и любого
MCP-клиента). Мост между ними существует и работает.

### Как сделать так, чтобы mind-mem вёл себя как нативная память

Три вещи, которых не хватает mind-mem для «нативного» ощущения, и чем каждая
закрывается:

| Чего не хватает | Чем закрыть | Уже стоит? |
|---|---|---|
| грузиться в контекст сам, в начале сессии | хук `SessionStart → mm resume-on-start` | ✅ ставит `mm install-all` |
| писаться самому по ходу работы | дневной лог + `mind-mem-capture` на `Stop` | ❌ доставить руками (§4.3) |
| знать то, что уже знает нативная память | `mm import --from agentmem` | ❌ разовая операция (§3) |

---

## 1. Что стоит прямо сейчас

```
                   tailnet 100.64.x.x
   ┌──────────────┬──────────────────┬─────────────────────┐
   │ iPhone       │ MacBook          │ этот хост           │
   │ 100.64.2.x   │ 100.64.2.x       │ 100.64.1.2          │
   └──────┬───────┴────────┬─────────┴──────────┬──────────┘
          │                │                    │
          ▼                ▼                    ▼
   ┌─────────────────────────────┐   ┌──────────────────────────┐
   │ :3010  nginx (basic auth)   │   │ :18796/mcp   MCP         │
   │   логин aac                 │   │   Bearer ← ~/.mind-mem-  │
   │        │                    │   │            web-token     │
   │        ▼ 127.0.0.1:3011     │   │   Claude Code ✔          │
   │   Next.js (только loopback) │   │   Codex ✔                │
   │        │                    │   └────────────┬─────────────┘
   │        │ route.ts кладёт    │                │
   │        │ Bearer             │                │
   └────────┼────────────────────┘                │
            ▼                                     ▼
   ┌────────────────────────────────────────────────────────────┐
   │  :18795  REST API   (Bearer)                               │
   │  /v1/recall  /v1/scan  /v1/contradictions  /v1/health …    │
   └───────────────────────────┬────────────────────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │  ~/.mind-mem/workspace/                                    │
   │    memory/IMPORTED.md      111 блоков из vault (2.3 МБ)    │
   │    decisions/DECISIONS.md  решения, вкл. релиз импорта     │
   │    memory/YYYY-MM-DD.md    дневной лог ← сюда пишет capture│
   │    .mind-mem-index/        SQLite: blocks + FTS5 + вектор  │
   │    .mind-mem-audit/        hash chain + evidence chain     │
   └────────────────────────────────────────────────────────────┘

   127.0.0.1:11434  ollama qwen3:1.7b  (локальный LLM, наружу закрыт)
```

systemd user-юниты: `mind-mem-api`, `mind-mem-mcp`, `mind-mem-ui` — включены,
linger, токены через `EnvironmentFile=~/.mind-mem-web.env`.

```bash
systemctl --user status mind-mem-api mind-mem-mcp mind-mem-ui
```

| Что | Адрес | Аутентификация |
|---|---|---|
| REST API | `http://100.64.1.2:18795` | Bearer, `~/.mind-mem-web-token` |
| MCP streamable HTTP | `http://100.64.1.2:18796/mcp` | Bearer, тот же токен |
| Веб-консоль | `http://100.64.1.2:3010` | basic auth `aac`, `~/.mind-mem-ui-basicauth-cred` |
| Локальный LLM | `127.0.0.1:11434` | нет (loopback) |

`governance_mode: governed`. Из ~50 флагов v4 включены `lint` и
`bootstrap_corpus`, остальные выключены — это норма, они ship default-OFF.

---

## 2. Единственный принцип, из которого следует всё остальное

**Чтение мгновенное. Запись — только через человека.**

```
ЧТЕНИЕ                                                    ЗАПИСЬ
──────                                                    ──────
recall(query)                                             propose_update
     │                                                          │
     ▼                                                          ▼
intent_classify (9 типов запроса)                     governance_gate
     │  подбирает веса                                  admit_block
     ▼                                                          │
┌─────────────┬──────────────┐                                  ▼
│  BM25F      │   вектор     │                          quality_gate
│  Porter     │  sqlite-vec  │                        (детерминированный)
│  + RM3      │  / pgvector  │                                  │
└──────┬──────┴───────┬──────┘                                  ▼
       └──── RRF ─────┘                                 очередь предложений
              │  фьюжн                                          │
              ▼                                                 ▼
    co-retrieval graph boost                        ┌───────────────────────┐
    (PageRank-подобный,                             │  ТЫ, вручную:         │
     питается полем Links:)                         │  MIND_MEM_SCOPE=admin │
              │                                     │  mm review --approve  │
              ▼                                     └───────────┬───────────┘
    adaptive knee cutoff                                        │
    (3–15, не фиксированный top-K)                              ▼
              │                                        запись + audit chain
              ▼                                                 │
    admission filter ◄── здесь отсекаются                       ▼
    (quarantined не выдаётся)                          build_index (иначе
              │                                         recall не увидит)
              ▼
    RECALL_ATTEST_v2
    (запрос ↔ digest выданного набора)
```

Отсюда всё: почему память не наполняется сама, почему импорт падает в карантин,
почему `approve` требует отдельного скоупа. Это не недоделка — это то, чем
mind-mem отличается от mem0/Letta, где в память пишет LLM без спроса.

---

## 3. Мост с нативной памятью Claude Code

Разовая операция. Забирает 53 типизированные заметки (`user`, `feedback`,
`project`, `reference`) в корпус mind-mem, где они получают ранжирование,
детекцию противоречий, аудит и доступ из Codex.

```bash
cd ~/.mind-mem/workspace

# 1. Посмотреть, что заберётся (ничего не пишет)
mm import --from agentmem ~/.claude/projects/-home-aac/memory --dry-run
# → parsed: 53, imported: 53, status: quarantined

# 2. Забрать (всё падает в карантин, recall пока не видит)
mm import --from agentmem ~/.claude/projects/-home-aac/memory --dedup-near

# 3. Застейджить релиз
python - <<'EOF'
from mind_mem.importers.quarantine import propose_import_release, quarantined_import_ids
ids = [i for i in quarantined_import_ids('.', 'memory/IMPORTED.md')]
print(propose_import_release('.', ids, system='agentmem',
      rationale='нативная авто-память Claude Code, автор — я'))
EOF

# 4. Одобрить и переиндексировать
MIND_MEM_SCOPE=admin mm review --approve P-YYYYMMDD-NNN --reason "своя память"
python -c "from mind_mem import sqlite_index as si; si.build_index('.')"
```

**Что это даёт на практике:** твои `feedback_*` заметки («не удаляй непроверенный
код», «не убирай vpn из headscale DNS») начнут находиться через `recall` из
Codex и любого другого клиента, а не только в Claude Code. И mind-mem начнёт
ловить, когда одна из них противоречит другой.

**Чего это НЕ делает:** нативная память продолжит жить своей жизнью и писаться
сама. Мост односторонний и разовый — повторный запуск идемпотентен (id
выводятся из контента), так что можно гонять периодически, чтобы подтягивать
новое.

---

## 4. Claude Code

### 4.1. Локальный MCP (stdio) — уже подключён

102 инструмента в сессии. Рабочее ядро:

| Инструмент | Зачем |
|---|---|
| `recall` | поиск по памяти |
| `find_similar` | «что похоже на этот блок» |
| `pack_recall_budget` | recall с упаковкой под лимит токенов |
| `propose_update` | предложить факт к записи |
| `list_contradictions` | что противоречит само себе |
| `stale_blocks` | что протухло |
| `verify_chain` | цепочка аудита цела? |
| `retrieval_diagnostics` | почему выдало именно это |

### 4.2. Удалённый MCP по tailnet

Нужен, когда Claude Code запущен **не на этом хосте** (ноут, coder-воркспейс).

```bash
claude mcp add --transport http mind-mem-remote \
  "http://100.64.1.2:18796/mcp" \
  -H "Authorization: Bearer $(cat ~/.mind-mem-web-token)"

claude mcp get mind-mem-remote     # ждём: Status: ✔ Connected, Type: http
```

> До фикса (`c1a53de`) `--transport http` отдавал **устаревший SSE**:
> `POST /mcp` → 404, `POST /sse` → 405. Работал только Claude Code, Codex — нет.

### 4.3. Хуки на таймлайне сессии

Вот где что срабатывает и что туда стоит повесить:

```
 запуск claude
      │
      ├─ SessionStart ──────► mm status            ✅ ставит install-all
      │                       mm resume-on-start   ✅ ставит install-all
      │                       (грузит память в контекст — это и есть
      │                        «как нативная»; exit 0 всегда, безопасен)
      │
      ▼
 ┌─────────────────────── работа ────────────────────────┐
 │                                                        │
 │  UserPromptSubmit ──► (можно: mm context "$PROMPT")   │
 │        │               ⚠ срабатывает на КАЖДЫЙ промпт │
 │        ▼                                               │
 │  PreToolUse ─────────► ⛔ НЕ вешать непроверенное     │
 │        │                                               │
 │     вызов инструмента                                  │
 │        │                                               │
 │  PostToolUse ────────► ⛔ грабля: сюда апстрим повесил │
 │        │                mm capture --stdin, команды    │
 │        │                не существует → каскад ошибок  │
 │        │                → хук удалён из установщика    │
 │        ▼                                               │
 │  PreCompact ─────────► сложить накопленное в дневной   │
 │                        лог, пока контекст не срезали   │
 └────────────────────────────────────────────────────────┘
      │
      ├─ Stop ──────────────► mm status            ✅ ставит install-all
      │                       mind-mem-capture     ❌ доставить руками
      │                       (извлечь кандидатов в предложения)
      ▼
 конец сессии
```

`mm install-all` вешает ровно **три** хука: `SessionStart → mm status`,
`SessionStart → mm resume-on-start`, `Stop → mm status`. Авто-захвата среди них
нет — вот что добавить в `~/.claude/settings.json`:

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "mm resume-on-start" }] }
    ],

    // Перед компактом — зафиксировать метку в дневном логе,
    // чтобы capture потом нашёл, что разбирать
    "PreCompact": [
      { "hooks": [{ "type": "command",
        "command": "date '+## %H:%M сессия' >> ~/.mind-mem/workspace/memory/$(date +%F).md" }] }
    ],

    // В конце сессии — извлечь кандидатов в предложения
    "Stop": [
      { "hooks": [{ "type": "command", "command": "mind-mem-capture" }] }
    ]
  }
}
```

**Правило про `PostToolUse`:** он срабатывает после **каждого** вызова
инструмента. Падающая команда там кладёт всю сессию — именно это и произошло у
апстрима. Прежде чем вешать что-то туда, прогони команду руками и убедись, что
она выходит с нулём.

### 4.4. `mm tool-run` — недооценённое

Вместо простыни в 4000 строк в контекст:

```bash
mm tool-run -- pytest tests/
# → handle=to-3be2281bc32a84f3  (2 lines, 0 failures, 0 elided)
#   recall: mm tool-recall to-3be2281bc32a84f3
```

Сам считает строки с ошибками, показывает их, середину сворачивает. В контекст
уходит сводка; полный вывод — по хендлу, если понадобится. Проверено вживую.

Применяй для тестов, билдов, `docker logs`, длинных `curl`.

---

## 5. Codex CLI

### 5.1. Локально (stdio) — уже в `~/.codex/config.toml`

```toml
[mcp_servers.mind-mem]
command = "/home/aac/.local/bin/mind-mem-mcp"
args = []

[mcp_servers.mind-mem.env]
MIND_MEM_WORKSPACE = "/home/aac/.mind-mem/workspace"
```

### 5.2. Удалённо

```bash
export MIND_MEM_TOKEN="$(cat ~/.mind-mem-web-token)"
codex mcp add mind-mem-remote \
  --url "http://100.64.1.2:18796/mcp" \
  --bearer-token-env-var MIND_MEM_TOKEN
```

Codex принимает **только streamable HTTP** — SSE он не умеет, поэтому до фикса
транспорта подключиться не мог.

### 5.3. Без MCP — CLI-мост

```bash
codex-mem() {
  mm inject --agent codex "$*" > /tmp/codex-ctx.md
  codex --context /tmp/codex-ctx.md "$@"
}
```

> `docs/usage.md` показывает здесь `--quiet` — **такого флага нет**, у `inject`
> только `--agent` и `--limit`.

---

## 6. ChatGPT

MCP-клиента у ChatGPT нет. Два честных пути.

**6.1. Ручной — работает сегодня:**

```bash
mm context "что я знаю про headscale DNS" --max-tokens 3000
```

Копируешь вывод в чат. Примитивно, но ничего не открывает наружу.

**6.2. Custom GPT Action по OpenAPI.** Артефакт готов: `sdk/spec/openapi.json`,
OpenAPI 3.1.0, 13 путей, `securitySchemes: HTTPBearer`.

```bash
mind-mem-openapi     # перегенерировать из живого приложения
```

**Чего это стоит:** ChatGPT ходит из интернета и в tailnet не попадёт — нужен
публичный HTTPS через Coolify/traefik. А в корпусе сейчас лежат заметки из
vault, включая ту, где написано «**Пароли внутри**».

Если делать — то только так:
1. сначала вычистить блоки с кредами;
2. отдельный ключ через `/v1/admin/api_keys`, не главный токен;
3. в spec оставить **только** `/v1/recall` и `/v1/health` — без `approve_apply`
   и `admin/*`, чтобы Action физически не мог писать;
4. рейт-лимит на traefik.

Пока пункт 1 не сделан — путь 6.1.

---

## 7. Три двери наполнения и жизненный цикл блока

```
① дневной лог              ② импорт                ③ propose_update
memory/YYYY-MM-DD.md       mm import --from …      (MCP / REST)
   ▲                              │                        │
   │ пишет хук PreCompact         │                        │
   │ или ты руками                │                        │
   │                              │                        │
mind-mem-capture                  │                        │
извлекает кандидатов              │                        │
   │                              │                        │
   └──────────────┬───────────────┴────────────────────────┘
                  ▼
         очередь предложений / карантин
                  │
                  ▼
        MIND_MEM_SCOPE=admin mm review
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
   --approve P-…        --reject P-…
        │
        ▼
   корпус + audit chain
        │
        ▼
   build_index('.')  ◄── без этого recall не увидит
```

Жизненный цикл одного блока:

```
   импортирован              одобрен релизом           найден дефект
        │                          │                        │
        ▼                          ▼                        ▼
  ┌───────────┐  release      ┌────────┐  supersedes  ┌──────────┐
  │quarantined│─────────────► │ active │─────────────►│superseded│
  └───────────┘  proposal     └────────┘   (типизир.  └──────────┘
        │                        │  │      ребро)          │
   recall НЕ видит          recall видит              recall НЕ видит
                                 │  │
                        нет обращений N дней
                                 │  │
                                 ▼  ▼
                         ┌──────────────┐
                         │ stale / dead │  ← stale_blocks,
                         └──────────────┘    propagate_staleness,
                                             check_dead_ends
```

**Массовый импорт (как делали с vault):**

```bash
mm import --from markdown ~/obsidian-vault --link-edges --dedup-near --dry-run
mm import --from markdown ~/obsidian-vault --link-edges --dedup-near
# → 114 распарсено, 111 импортировано, 3 near-duplicate, 310 связей
```

Лимит: 500 блоков на одно предложение (`MAX_RELEASE_BLOCKS`). Бюджет
предложений: 3 за прогон, 6 в день, 30 в бэклоге.

---

## 8. Ежедневный цикл

```bash
# ── ДО ───────────────────────────────────────────────────
mm resume                                  # где остановился (task frames)
mm dead-ends                               # что пробовал и не сработало
mm context "тема" --max-tokens 2000        # контекст в промпт

# ── ВО ВРЕМЯ ─────────────────────────────────────────────
mm tool-run -- pytest tests/               # длинные выводы через хендл
# recall / propose_update — из Claude Code через MCP

# ── ПОСЛЕ ────────────────────────────────────────────────
echo "## решение: X, потому что Y" >> ~/.mind-mem/workspace/memory/$(date +%F).md
mind-mem-capture
MIND_MEM_SCOPE=admin mm review
python -c "from mind_mem import sqlite_index as si; si.build_index('.')"
```

`mm dead-ends` — то, чего нет ни у mem0, ни у Context7: реестр негативного
опыта. Записанный однажды тупик больше не повторяется.

---

## 9. Что НЕ работает — чтобы не искать зря

### Требует LLM (локальный есть, но слабый)

`dream_cycle`, `plan_consolidation`, `memory_evolution`, `mm graph-backfill`,
`extraction` — всё через модель.

Замер на `qwen3:1.7b`, настоящий `_RELATION_PROMPT`, настоящий блок:
**47 секунд на блок**, предикаты неверные, JSON обрезан на 512 токенах. На 111
блоков — ~87 минут мусора. **Граф знаний строить не стоит.**

Связи и без него есть: 310 wikilink-целей в поле `Links:` на 106 блоках, они
уже работают на graph-boost в recall.

```bash
# если всё же — только локально, не в OpenAI:
export MIND_MEM_LLM_BASE_URL=http://127.0.0.1:11434/v1
mm graph-backfill --limit 20          # сначала замер, без записи
```

> Не направляй extraction в OpenAI, пока в корпусе лежат креды:
> `graph-backfill` отправляет **содержимое блоков**.

### Требует флага в `mind-mem.json`

```json
"v4": { "block_kinds": { "enabled": true } }
```

Выключены `block_kinds`, `core_export`, `granularity_align`, `self_editing`,
`federation`, `streaming_recall`, `cognitive_kernel`, `ingest_serve`,
`multi_modal`, `chat`, `long_context_recall`, `observability` и ещё ~40.

### Требует admin-скоупа

`approve_apply`, `rollback_proposal`, `delete_memory_item`, `reindex_vectors`.
Инструмент **сам себя не повысит** — осознанный дизайн.

### Работает не так, как ждёшь

- **`lint` не видит импортированные блоки.** `_LINTED_FILES` — только
  `decisions/DECISIONS.md` и `tasks/TASKS.md`, правила привязаны к id
  `^[A-Z]+-\d{8}-\d{3}$`, а у импорта id `IMP-markdown-…`. `mm lint` → 0
  находок, и это правда, а не тишина.
- **Автофикс `missing_metadata` не применяется никогда.** Чинит `Scope` и
  `Supersedes`, оба обязательны, а `check_preconditions` отказывает при любом
  issue — дефект блокирует собственное исправление.
- **`mm capture` не существует.** Нужен `mind-mem-capture`, и он читает
  `memory/YYYY-MM-DD.md`, а не stdin. `docs/usage.md` предлагает
  `cat transcript.txt | mm capture --stdin` — не сработает.
- **`mm inject --quiet` не существует** — ещё один пример из доков, который падает.
- **`mm doctor --rebuild-cache` не инициализирует схему** (исправлено в
  `2b7a77f`; если словишь `no such table: blocks_fts` — `build_index('.')`).

---

## 10. Шпаргалка

```bash
# поиск
mm recall "запрос"
mm context "запрос" --max-tokens 2000
mm inject --agent codex "запрос"

# непрерывность
mm resume
mm dead-ends
mm tool-run -- <команда>          →  mm tool-recall to-…

# состояние
mm status ; mm doctor ; mm lint
mind-mem-validate .
mind-mem-verify .                 # целостность цепочек

# запись
mind-mem-capture
MIND_MEM_SCOPE=admin mm review
MIND_MEM_SCOPE=admin mm review --approve P-… --reason "..."
python -c "from mind_mem import sqlite_index as si; si.build_index('.')"

# мост с нативной памятью Claude Code
mm import --from agentmem ~/.claude/projects/-home-aac/memory --dry-run

# сервисы
systemctl --user restart mind-mem-api mind-mem-mcp mind-mem-ui
```

---

## 11. Траблшутинг — по симптомам, которые реально были

| Симптом | Причина | Что делать |
|---|---|---|
| `recall` → `count: 0` при полном корпусе | блоки `quarantined`, релиз не одобрен | `mm review`, одобрить `P-…` |
| `no such table: blocks_fts` | схема индекса не создана | `build_index('.')` |
| Скоры у всех одинаковые | термин в >50% корпуса, IDF≈0 | норма BM25, спроси конкретнее |
| `Post-checks failed, rolled back` | сгенерированный блок не проходит валидатор | `mind-mem-validate .` — какого поля нет |
| `Status must be 'staged' to apply` | предложение уже откатывалось | стейджить заново |
| `detect_only mode does not allow apply` | `governance_mode` | править в `mind-mem.json` **и** в `memory/intel-state.json` |
| `MCP scope is 'user'` | нет admin | `MIND_MEM_SCOPE=admin` |
| Claude Code видит MCP, Codex — нет | SSE вместо streamable HTTP | исправлено в `c1a53de`, URL `/mcp` |
| UI отдаёт 401 | basic auth | логин `aac`, `~/.mind-mem-ui-basicauth-cred` |

---

## 12. Открытые решения — за тобой

1. **Мост с нативной памятью** (§3) — 53 блока ждут импорта. Разово, идемпотентно.
2. **`mm bind`.** Не запущен, и пока правильно: после привязки **любая** правка
   `mind-mem.json` блокирует все записи до `mm bind --rebind`. Запускать, когда
   конфиг устоялся.
3. **Один токен на всё.** `MIND_MEM_TOKEN` = `MIND_MEM_ADMIN_TOKEN` — у кого
   API-токен, тот админ над памятью. Разделяется одной строкой в
   `~/.mind-mem-web.env`.
4. **Креды в корпусе.** Блокирует и публичный доступ для ChatGPT, и любую
   внешнюю extraction.
5. **Корпусный гейт `check_preconditions`.** Пока требует нуля issue, автофикс
   линта наполовину мёртв: один непочиненный дефект блокирует все репейры.
