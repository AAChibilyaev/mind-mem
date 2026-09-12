# mind-mem: как это использовать (для AAC)

Практический документ под конкретную установку на `aachibilyaev.com`. Всё, что
здесь написано, проверено на этой машине 2026-09-12. Где документация проекта
расходится с фактом — это отмечено явно.

---

## 1. Что стоит прямо сейчас

| Что | Где | Аутентификация |
|---|---|---|
| REST API | `http://100.64.1.2:18795` | Bearer, токен в `~/.mind-mem-web-token` |
| MCP (streamable HTTP) | `http://100.64.1.2:18796/mcp` | Bearer, тот же токен |
| Веб-консоль | `http://100.64.1.2:3010` | basic auth, логин `aac`, пароль в `~/.mind-mem-ui-basicauth-cred` |
| Next.js за прокси | `127.0.0.1:3011` | только loopback |
| Воркспейс | `/home/aac/.mind-mem/workspace` | 111 released + 12 служебных блоков |
| Локальная модель | `127.0.0.1:11434` (ollama, `qwen3:1.7b`) | нет (loopback) |

systemd user-юниты: `mind-mem-api`, `mind-mem-mcp`, `mind-mem-ui` — включены,
с linger, токены через `EnvironmentFile=/home/aac/.mind-mem-web.env`.

```bash
systemctl --user status mind-mem-api mind-mem-mcp mind-mem-ui
```

`governance_mode: governed`. Флаги v4: включены только `lint` и
`bootstrap_corpus`, остальные 50 — выключены (это норма, они ship default-OFF).

---

## 2. Единственный принцип, который надо понять

**Чтение дешёвое и детерминированное. Запись проходит через человека.**

```
recall ──────────────────────────────► мгновенно, без одобрения
                                        (BM25F + вектор + RRF + graph-boost)

propose_update ──► review ──► approve_apply ──► в корпус
                     ▲
                 ты, вручную, с MIND_MEM_SCOPE=admin
```

Отсюда всё остальное: почему память не наполняется сама, почему импорт
попадает в карантин, почему `approve` требует отдельного скоупа. Это не
недоделка — это то, чем mind-mem отличается от mem0/Letta, где в память пишет
LLM без спроса.

---

## 3. Claude Code

### 3.1. Локальный MCP (stdio) — уже подключён

102 инструмента доступны прямо в сессии. Самые рабочие:

| Инструмент | Зачем |
|---|---|
| `recall` | поиск по памяти |
| `find_similar` | «что похоже на этот блок» |
| `pack_recall_budget` | recall с упаковкой под лимит токенов |
| `propose_update` | предложить факт/решение к записи |
| `list_contradictions` | что в памяти противоречит само себе |
| `stale_blocks` | что протухло |
| `verify_chain` | цепочка аудита цела? |
| `retrieval_diagnostics` | почему выдало именно это |

### 3.2. Удалённый MCP по tailnet — работает с сегодня

Нужен, когда Claude Code запущен **не на этом хосте** (ноут, второй сервер,
coder-воркспейс).

```bash
claude mcp add --transport http mind-mem-remote \
  "http://100.64.1.2:18796/mcp" \
  -H "Authorization: Bearer $(cat ~/.mind-mem-web-token)"

claude mcp get mind-mem-remote     # ждём: Status: ✔ Connected, Type: http
```

> До фикса (`c1a53de`) флаг `--transport http` отдавал **устаревший SSE**:
> `POST /mcp` → 404, `POST /sse` → 405. Работал только Claude Code, Codex — нет.
> Теперь оба.

### 3.3. Хуки — что ставится по факту, а что надо доставить руками

`mm install-all` прописывает в `~/.claude/settings.json` ровно **три** хука:

```
SessionStart → mm status
SessionStart → mm resume-on-start
Stop         → mm status
```

**Чего там нет и почему:** `PostToolUse → mm capture --stdin` был удалён из
установщика, потому что **`mm capture` не существует как подкоманда** — хотя
`docs/usage.md` его рекомендует. Установленный на PostToolUse, он давал
каскадный цикл ошибок и блокировал правки. Настоящая команда называется
`mind-mem-capture` и работает **не со stdin**, а с дневным логом.

Что стоит добавить вручную в `~/.claude/settings.json`:

```jsonc
{
  "hooks": {
    // Контекст памяти в начало каждой сессии (уже стоит после install-all)
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "mm resume-on-start" }] }
    ],

    // Перед компактом — сложить, что накопилось, в дневной лог,
    // чтобы capture потом это разобрал
    "PreCompact": [
      { "hooks": [{ "type": "command",
        "command": "date '+## %H:%M сессия' >> ~/.mind-mem/workspace/memory/$(date +%F).md" }] }
    ],

    // В конце сессии — прогнать извлечение кандидатов в предложения
    "Stop": [
      { "hooks": [{ "type": "command", "command": "mind-mem-capture" }] }
    ]
  }
}
```

**Не вешай ничего на `PostToolUse`**, пока не проверишь команду вручную:
хук срабатывает после **каждого** вызова инструмента, и падающая команда там
кладёт всю сессию. Это ровно та грабля, на которую наступил установщик.

### 3.4. `mm tool-run` — недооценённая вещь

Вместо того чтобы гнать тебе в контекст 4000 строк вывода `pytest`:

```bash
mm tool-run -- pytest tests/
# → handle=to-3be2281bc32a84f3  (2 lines, 0 failures, 0 elided)
#   recall: mm tool-recall to-3be2281bc32a84f3
```

Он сам суммаризует: считает строки с ошибками, показывает их, середину
сворачивает. В контекст уходит сводка, полный вывод достаётся по хендлу
только если понадобится. Проверено вживую.

Применяй для: тестов, билдов, `docker logs`, длинных `curl`.

---

## 4. Codex CLI

### 4.1. Локально (stdio) — уже в `~/.codex/config.toml`

```toml
[mcp_servers.mind-mem]
command = "/home/aac/.local/bin/mind-mem-mcp"
args = []

[mcp_servers.mind-mem.env]
MIND_MEM_WORKSPACE = "/home/aac/.mind-mem/workspace"
```

### 4.2. Удалённо — работает с сегодня

```bash
export MIND_MEM_TOKEN="$(cat ~/.mind-mem-web-token)"
codex mcp add mind-mem-remote \
  --url "http://100.64.1.2:18796/mcp" \
  --bearer-token-env-var MIND_MEM_TOKEN
```

Codex принимает **только streamable HTTP** (`--url` документирован именно так),
SSE он не умеет — поэтому до фикса транспорта подключиться не мог.

### 4.3. Если MCP не хочется — CLI-мост

```bash
mm inject --agent codex "миграции drizzle" > /tmp/ctx.md
codex --context /tmp/ctx.md "почини журнал миграций"
```

Или обёртка в `.bashrc`:

```bash
codex-mem() {
  mm inject --agent codex "$*" > /tmp/codex-ctx.md
  codex --context /tmp/codex-ctx.md "$@"
}
```

> `docs/usage.md` показывает здесь `mm inject --agent codex --quiet` — **флага
> `--quiet` не существует**, у `inject` только `--agent` и `--limit`.

---

## 5. ChatGPT

**MCP-клиента у ChatGPT нет.** Есть два честных пути.

### 5.1. Ручной — работает сегодня, без настройки

```bash
mm context "что я знаю про headscale DNS" --max-tokens 3000
```

Вывод — JSON с блоками, скорами и путями. Копируешь в чат. Примитивно, но
ничего не требует и ничего не открывает наружу.

### 5.2. Custom GPT Action — по OpenAPI

У проекта есть готовый артефакт: `sdk/spec/openapi.json`, OpenAPI **3.1.0**,
13 путей, `securitySchemes: HTTPBearer` — ровно то, что ест Custom GPT Action.

```bash
mind-mem-openapi           # перегенерировать из живого приложения
```

Доступные операции: `/v1/recall`, `/v1/scan`, `/v1/contradictions`,
`/v1/block/{id}`, `/v1/propose_update`, `/v1/approve_apply`,
`/v1/rollback_proposal`, `/v1/health`, `/v1/metrics`, `/v1/admin/api_keys*`.

**Чего это стоит — читай прежде чем делать:** ChatGPT ходит из интернета и в
tailnet попасть не может. Значит нужен публичный HTTPS-домен через
Coolify/traefik. А в памяти сейчас лежат импортированные заметки из vault,
включая ту, где написано «**Пароли внутри**».

Если делаешь — то не иначе как:
1. сначала вычистить блоки с кредами из корпуса;
2. отдельный API-ключ через `/v1/admin/api_keys` (не главный токен);
3. в spec оставить **только** `/v1/recall` и `/v1/health` — без `approve_apply`
   и без `admin/*`, чтобы Action физически не мог писать в память;
4. рейт-лимит на traefik.

Пока пункт 1 не сделан — путь 5.1.

---

## 6. Ежедневный цикл

```bash
# ── ДО работы ────────────────────────────────────────────
mm resume                                  # где остановился (task frames)
mm dead-ends                               # что уже пробовал и не сработало
mm context "тема" --max-tokens 2000        # контекст в промпт

# ── ВО ВРЕМЯ ─────────────────────────────────────────────
mm tool-run -- pytest tests/               # длинные выводы — через хендл
# recall / propose_update — прямо из Claude Code через MCP

# ── ПОСЛЕ ────────────────────────────────────────────────
echo "## решение: X, потому что Y" >> ~/.mind-mem/workspace/memory/$(date +%F).md
mind-mem-capture                           # извлечь кандидатов в предложения
MIND_MEM_SCOPE=admin mm review             # посмотреть и одобрить
```

`mm dead-ends` — та часть, которой нет ни у mem0, ни у Context7: реестр
негативного опыта. Записанный один раз тупик больше не повторяется.

---

## 7. Как память наполняется

Три двери, все три ведут в карантин или в очередь предложений — ни одна не
пишет в recall напрямую.

```
① дневной лог                ② импорт                  ③ propose_update
memory/YYYY-MM-DD.md         mm import --from …        (MCP / REST)
        │                            │                        │
        ▼                            ▼                        ▼
 mind-mem-capture            Status: quarantined        очередь предложений
 извлекает кандидатов        (невидим для recall)              │
        │                            │                        │
        └──────────► mm review ◄──────────────────────────────┘
                         │
              MIND_MEM_SCOPE=admin mm review --approve P-…
                         │
                         ▼
                 в корпус + audit chain
                         │
                         ▼
       python -c "from mind_mem import sqlite_index as si; si.build_index('.')"
```

Последний шаг обязателен: без пересборки индекса recall не увидит новое.

**Массовый импорт (как сегодня с vault):**

```bash
cd ~/.mind-mem/workspace
mm import --from markdown ~/obsidian-vault --link-edges --dedup-near --dry-run
mm import --from markdown ~/obsidian-vault --link-edges --dedup-near
# → 114 распарсено, 111 импортировано, 3 near-duplicate, 310 связей

python - <<'EOF'
from mind_mem.importers.quarantine import propose_import_release, quarantined_import_ids
ids = list(quarantined_import_ids('.', 'memory/IMPORTED.md'))
print(propose_import_release('.', ids, system='markdown',
      rationale='свои заметки, автор — я'))
EOF

MIND_MEM_SCOPE=admin mm review --approve P-YYYYMMDD-NNN
```

Лимит: 500 блоков на одно предложение (`MAX_RELEASE_BLOCKS`). Бюджет
предложений в воркспейсе: 3 за прогон, 6 в день, 30 в бэклоге.

---

## 8. Что НЕ работает — чтобы не искать зря

### Требует LLM (настроен локально, но слабо)

`dream_cycle`, `plan_consolidation`, `memory_evolution`, `mm graph-backfill`,
`extraction` — всё идёт через модель.

Локальный замер на `qwen3:1.7b`, реальный промпт, реальный блок:
**47 секунд на блок**, предикаты неверные, JSON обрезан на 512 токенах.
На 111 блоков это ~87 минут мусора. **Граф знаний строить не стоит.**

Связи и без него есть: 310 wikilink-целей лежат в поле `Links:` на 106 блоках
и работают на graph-boost в recall.

```bash
# если всё же захочешь — только через локальную модель, не через OpenAI:
export MIND_MEM_LLM_BASE_URL=http://127.0.0.1:11434/v1
mm graph-backfill --limit 20                 # сначала замер, без записи
```

> Не направляй extraction в OpenAI, пока в корпусе лежат креды. `graph-backfill`
> отправляет **содержимое блоков** на извлечение триплетов.

### Требует флага в `mind-mem.json`

```json
"v4": { "block_kinds": { "enabled": true } }
```

Выключены: `block_kinds`, `core_export`, `granularity_align`, `self_editing`,
`federation`, `streaming_recall`, `cognitive_kernel`, `ingest_serve`,
`multi_modal`, `chat`, `long_context_recall`, `observability` и ещё ~40.

### Требует admin-скоупа

`approve_apply`, `rollback_proposal`, `delete_memory_item`, `reindex_vectors`.
Инструмент **сам себя не повысит** — это осознанный дизайн.

### Работает не так, как ждёшь

- **`lint` не видит импортированные блоки.** `_LINTED_FILES` — только
  `decisions/DECISIONS.md` и `tasks/TASKS.md`, а правила привязаны к id вида
  `^[A-Z]+-\d{8}-\d{3}$`. У импорта id `IMP-markdown-…`. `mm lint` → 0 находок,
  и это правда, а не тишина.
- **Автофикс `missing_metadata` не применяется никогда.** Он чинит `Scope` и
  `Supersedes`, оба обязательны для DECISIONS.md, а `check_preconditions`
  отказывает при любом issue — дефект блокирует собственное исправление.
  Зафиксировано как `expectedFailure`.
- **`mm capture` не существует.** Нужен `mind-mem-capture`, и он читает
  `memory/YYYY-MM-DD.md`, а не stdin. `docs/usage.md` предлагает
  `cat transcript.txt | mm capture --stdin` — это не сработает.
- **`mm inject --quiet` не существует** — ещё один пример из `docs/usage.md`,
  который падает.
- **`mm doctor --rebuild-cache` не инициализирует схему** (исправлено в
  `2b7a77f`, но если словишь `no such table: blocks_fts` —
  `python -c "from mind_mem import sqlite_index as si; si.build_index('.')"`).

---

## 9. Шпаргалка

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
mm status
mm doctor
mm lint
mind-mem-validate .
mind-mem-verify .                 # целостность цепочек

# запись
mind-mem-capture
MIND_MEM_SCOPE=admin mm review
MIND_MEM_SCOPE=admin mm review --approve P-… --reason "..."

# индекс после любой записи
python -c "from mind_mem import sqlite_index as si; si.build_index('.')"

# сервисы
systemctl --user restart mind-mem-api mind-mem-mcp mind-mem-ui
```

---

## 10. Траблшутинг — по симптомам, которые реально были

| Симптом | Причина | Что делать |
|---|---|---|
| `recall` → `count: 0` при полном корпусе | блоки `quarantined`, релиз не одобрен | `mm review`, одобрить `P-…` |
| `no such table: blocks_fts` в логах | схема индекса не создана | `build_index('.')` |
| Скоры у всех результатов одинаковые | термин встречается в >50% корпуса, IDF≈0 | норма BM25, спроси конкретнее |
| `Post-checks failed, rolled back` | сгенерированный блок не проходит валидатор | смотри `validate` — какого поля нет |
| `Status must be 'staged' to apply` | предложение уже откатывалось, статус терминальный | стейджить заново |
| `detect_only mode does not allow apply` | `governance_mode` | в `mind-mem.json` **и** в `memory/intel-state.json` |
| `MCP scope is 'user'` | нет admin | `MIND_MEM_SCOPE=admin` |
| Claude Code видит MCP, Codex — нет | SSE вместо streamable HTTP | исправлено в `c1a53de`, URL `/mcp` |
| UI отдаёт 401 | basic auth | логин `aac`, `~/.mind-mem-ui-basicauth-cred` |

---

## 11. Открытые решения — за тобой

1. **`mm bind`.** Не запущен. Он вооружает детекцию правок `mind-mem.json`, но
   после привязки **любая** правка конфига блокирует все записи до
   `mm bind --rebind`. Запускать, когда конфиг устоялся.
2. **Один токен на всё.** `MIND_MEM_TOKEN` = `MIND_MEM_ADMIN_TOKEN` — у кого
   есть API-токен, тот админ над памятью. Разделяется одной строкой в
   `~/.mind-mem-web.env`.
3. **Креды в корпусе.** Импортированный vault содержит заметки с паролями. Это
   блокирует и публичный доступ для ChatGPT, и любую внешнюю extraction.
4. **Корпусный гейт `check_preconditions`.** Пока он требует нуля issue,
   автофикс линта наполовину мёртв: один непочиненный дефект блокирует все
   остальные репейры.
