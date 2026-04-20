# AGENTS

## Debugging Quick Toggle (Pi startup/autocomplete)

When debugging slow startup or delayed `/` autocomplete, enable the built-in debug flags below.

### 1) Fast startup timing breakdown
```bash
PI_TIMING=1 PI_STARTUP_BENCHMARK=1 pi
```
- Prints stage-by-stage startup timings (including `interactiveMode.init`).
- Useful to detect whether delay is in startup initialization vs runtime behavior.

### 2) Autocomplete debug logging
```bash
PI_AUTOCOMPLETE_DEBUG=1 pi
```
- Writes autocomplete lifecycle logs to:
  - `~/.pi/agent/pi-debug.log`
- Includes markers such as:
  - interactive mode construction
  - autocomplete setup timing
  - extension binding start/end
  - first `/` input timing and provider state

### 3) Typical repro flow for delayed `/` suggestions
```bash
cd /
PI_AUTOCOMPLETE_DEBUG=1 pi
```
Then immediately type `/` and inspect logs:
```bash
tail -n 120 ~/.pi/agent/pi-debug.log
```

### 4) Keep debug off by default
These flags are opt-in and should remain off in normal usage.
