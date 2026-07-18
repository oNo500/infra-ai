#!/usr/bin/env bun
// Harness for the runCli routing test: calls runCli({ isTTY: false }) directly
// (bypassing process.stdout.isTTY, which is unreliable under a test runner's
// piped stdout) so the non-TTY branch is exercised even when this script's
// own stdout happens to be a real TTY. Runs out-of-process because citty's
// "no command" path calls process.exit(1), which would kill the test runner.
import { runCli } from '../../src/cli/index'

await runCli({ isTTY: false })
