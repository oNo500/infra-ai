#!/usr/bin/env bun
// Harness for the runCli routing test: calls runCli({ isTTY: true }) with argv
// patched to ['stauts'] (a typo'd subcommand). Before the argv.length === 0
// tightening, hasNoSubcommand(['stauts']) was true (the string isn't a known
// subcommand name), so this would have hijacked into the TUI on a TTY. Now
// any non-empty argv always falls through to citty, which reports the
// unknown command. Runs out-of-process: citty's unknown-command path calls
// process.exit(1), and a spurious TUI render would put stdin in raw mode and
// hang waiting for input.
import { runCli } from '../../src/cli/index'

process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'run-cli-tty-typo.ts', 'stauts']

await runCli({ isTTY: true })
