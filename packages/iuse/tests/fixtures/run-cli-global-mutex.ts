#!/usr/bin/env bun
// Harness for the status/diff/list --global + target mutual-exclusion test:
// runs out-of-process because it exercises the real citty run() handler's
// process.exitCode = 2 side effect, which -- once set in-process -- cannot be
// reliably unset afterward (Bun/Node ratchet process.exitCode; see cli.test.ts
// comment). argv[2] selects which subcommand to invoke.
import { runCli } from '../../src/cli/index'

const subcommand = process.argv[2]
if (subcommand === undefined) throw new Error('usage: run-cli-global-mutex.ts <status|diff|list>')

process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'iuse', subcommand, '--global', '/tmp/x']
await runCli({ isTTY: false })
