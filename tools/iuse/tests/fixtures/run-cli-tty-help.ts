#!/usr/bin/env bun
// Harness for the runCli --help/TTY hijack test: calls runCli({ isTTY: true })
// directly with argv patched to ['--help']. The TUI branch requires EMPTY
// argv, so non-empty argv like this always falls through to citty regardless
// of TTY -- this proves that even on an interactive terminal, a real flag
// never gets swallowed by the TUI. Runs out-of-process so a spurious TUI
// render (raw-mode stdin, ink render loop) can't hang or otherwise disturb
// the test runner.
import { runCli } from '../../src/cli/index'

process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'run-cli-tty-help.ts', '--help']

await runCli({ isTTY: true })
