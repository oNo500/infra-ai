#!/usr/bin/env bun
// Harness for the runCli --help/TTY hijack test: calls runCli({ isTTY: true })
// directly with argv patched to ['--help'] so the bare-TTY-with-no-subcommand
// branch would fire if the help/version guard were missing. Runs out-of-process
// so a spurious TUI render (raw-mode stdin, ink render loop) can't hang or
// otherwise disturb the test runner.
import { runCli } from '../../src/cli/index'

process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'run-cli-tty-help.ts', '--help']

await runCli({ isTTY: true })
