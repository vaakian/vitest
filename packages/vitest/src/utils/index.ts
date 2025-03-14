// eslint-disable-next-line no-restricted-imports
import { relative as relativeBrowser } from 'path'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { relative as relativeNode } from 'pathe'
import type { ModuleCacheMap } from 'vite-node'
import type { Suite, Task } from '../types'
import { EXIT_CODE_RESTART } from '../constants'
import { getNames } from './tasks'

export * from './tasks'
export * from './base'
export * from './global'
export * from './timers'

export const isNode = typeof process < 'u' && typeof process.stdout < 'u' && !process.versions?.deno && !globalThis.window
// export const isNode = typeof process !== 'undefined' && typeof process.platform !== 'undefined'
export const isBrowser = typeof window !== 'undefined'
export const isWindows = isNode && process.platform === 'win32'

export const relativePath = isBrowser ? relativeBrowser : relativeNode

/**
 * Partition in tasks groups by consecutive concurrent
 */
export function partitionSuiteChildren(suite: Suite) {
  let tasksGroup: Task[] = []
  const tasksGroups: Task[][] = []
  for (const c of suite.tasks) {
    if (tasksGroup.length === 0 || c.concurrent === tasksGroup[0].concurrent) {
      tasksGroup.push(c)
    }
    else {
      tasksGroups.push(tasksGroup)
      tasksGroup = [c]
    }
  }
  if (tasksGroup.length > 0)
    tasksGroups.push(tasksGroup)

  return tasksGroups
}

export function resetModules(modules: ModuleCacheMap, resetMocks = false) {
  const skipPaths = [
    // Vitest
    /\/vitest\/dist\//,
    // yarn's .store folder
    /vitest-virtual-\w+\/dist/,
    // cnpm
    /@vitest\/dist/,
    // don't clear mocks
    ...(!resetMocks ? [/^mock:/] : []),
  ]
  modules.forEach((_, path) => {
    if (skipPaths.some(re => re.test(path)))
      return
    modules.delete(path)
  })
}

export function getFullName(task: Task) {
  return getNames(task).join(c.dim(' > '))
}

export async function ensurePackageInstalled(
  dependency: string,
  root: string,
) {
  if (isPackageExists(dependency, { paths: [root] }))
    return true

  const promptInstall = !process.env.CI && process.stdout.isTTY

  process.stderr.write(c.red(`${c.inverse(c.red(' MISSING DEP '))} Can not find dependency '${dependency}'\n\n`))

  if (!promptInstall)
    return false

  const prompts = await import('prompts')
  const { install } = await prompts.prompt({
    type: 'confirm',
    name: 'install',
    message: c.reset(`Do you want to install ${c.green(dependency)}?`),
  })

  if (install) {
    await (await import('@antfu/install-pkg')).installPackage(dependency, { dev: true })
    // TODO: somehow it fails to load the package after installation, remove this when it's fixed
    process.stderr.write(c.yellow(`\nPackage ${dependency} installed, re-run the command to start.\n`))
    process.exit(EXIT_CODE_RESTART)
    return true
  }

  return false
}

/**
 * If code starts with a function call, will return its last index, respecting arguments.
 * This will return 25 - last ending character of toMatch ")"
 * Also works with callbacks
 * ```
 * toMatch({ test: '123' });
 * toBeAliased('123')
 * ```
 */
export function getCallLastIndex(code: string) {
  let charIndex = -1
  let inString: string | null = null
  let startedBracers = 0
  let endedBracers = 0
  let beforeChar: string | null = null
  while (charIndex <= code.length) {
    beforeChar = code[charIndex]
    charIndex++
    const char = code[charIndex]

    const isCharString = char === '"' || char === '\'' || char === '`'

    if (isCharString && beforeChar !== '\\') {
      if (inString === char)
        inString = null
      else if (!inString)
        inString = char
    }

    if (!inString) {
      if (char === '(')
        startedBracers++
      if (char === ')')
        endedBracers++
    }

    if (startedBracers && endedBracers && startedBracers === endedBracers)
      return charIndex
  }
  return null
}

const resolve = isNode ? relativeNode : relativeBrowser

export { resolve as resolvePath }

// AggregateError is supported in Node.js 15.0.0+
class AggregateErrorPonyfill extends Error {
  errors: unknown[]
  constructor(errors: Iterable<unknown>, message = '') {
    super(message)
    this.errors = [...errors]
  }
}
export { AggregateErrorPonyfill as AggregateError }
