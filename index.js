'use strict'
const system = require('@perl/system')
const qx = require('@perl/qx')
const path = require('path')
const Bluebird = require('bluebird')
const fs = require('fs')
const unlink = Bluebird.promisify(fs.unlink)
const readFile = Bluebird.promisify(fs.readFile)
const writeFile = Bluebird.promisify(fs.writeFile)
const rename = Bluebird.promisify(fs.rename)
const stat = Bluebird.promisify(fs.stat)
const mkdirp = Bluebird.promisify(require('mkdirp'))
const rimraf = Bluebird.promisify(require('rimraf'))
const glob = Bluebird.promisify(require('glob'))
const yargs = require('@iarna/cli')(main)
  .usage('assetize [<modules…>]')
  .help()

async function main (opts, name) {
  if (name) {
    let proj
    try {
      proj = JSON.parse(await readFile('package.json'))
    } catch (_) {
      proj = {}
    }
    if (!proj.assetDependencies) proj.assetDependencies = {}
    await installModules(proj, opts._, true)
    await writeFile('package.json', JSON.stringify(proj, null, 2))
  } else {
    try {
      const proj = JSON.parse(await readFile('package.json'))
      const assetDeps = proj.assetDependencies || {}
      await installModules(proj, Object.keys(assetDeps).map(n => `${n}@${assetDeps[n]}`), true)
    } catch (_) {
      yargs.showHelp()
    }
  }
}

const seenThisRun = new Set()

async function installModules (proj, modules, isTop) {
  await Bluebird.map(modules, name => installModule(proj, name, isTop))
}

async function installModule (proj, name, isTop) {
  if (seenThisRun.has(name)) return
  console.log('! installing', name)
  seenThisRun.add(name)
  let packument = JSON.parse(await qx`npm show ${name} --json`)
  if (Array.isArray(packument)) packument = packument[0]
  const tarball = await qx`npm pack "${name}"`
  const pkg = await Bluebird.resolve(installFromTarball(proj, packument, tarball)).finally(() => unlink(tarball))
  if (isTop && pkg.version && !proj.assetDependencies[pkg.name]) {
    proj.assetDependencies[pkg.name] = `^${pkg.version}`
  }
}

function hasScope (name) {
  return String(name)[0] === '@'
}

async function installFromTarball (proj, packument, tarball) {
  await rimraf(`assets/${packument.name}`)
  await mkdirp(`assets/${packument.name}`)
  await system(`tar xf "${tarball}" --strip-components 1 -C "assets/${packument.name}"`)
  const pkg = JSON.parse(await readFile(`assets/${packument.name}/package.json`))
  await transformTheJS(packument.name)
  await installModules(proj, Object.keys(pkg.dependencies || {}).map(name => `${name}@${pkg.dependencies[name]}`))
  let main = (pkg.main || 'index.js').replace(/[.]mjs$/, '.js')
  if (!await exists(main) && await exists(main + '.js')) {
    main += '.js'
  }
  const prefix = hasScope(pkg.name) ? pkg.name.slice(pkg.name.indexOf('/')+1) : pkg.name

  await writeFile(`assets/${pkg.name}.js`,
    `export * from './${prefix}/${main}'\n` +
    `export { default } from './${prefix}/${main}'\n`)
  return pkg
}

function parseReq (name) {
  const matched = name.match(/^([.]|(?:[@][^/]+[/])?[^@/]+)(?:[/]([^@]+))?$/)
  return {
    name: matched[1],
    pathinfo: matched[2]
  }
}

async function exists (name) {
  try {
    await stat(name)
    return true
  } catch (_) {
    return false
  }
}

async function transformTheJS (name) {
  const mjs = await glob(`assets/${name}/**/*.mjs`)
  await Bluebird.map(mjs, file => rename(file, file.replace(/[.]mjs$/, '.js')))
  const js = await glob(`assets/${name}/**/*.js`)
  await Bluebird.map(js, async file => {
    let content = await readFile(file, 'utf8')
    content = content.replace(/(import.*from.*['"])([A-Za-z@.][.]?[-A-Za-z0-9_/]+[^"']*)/g, (match, prelude, spec) => {
      const thisModule = parseReq(spec)
      path.relative('assets/foo/bar.js', path.resolve('assets/foo/bar.js', './././foo.js'))
      let modpath = thisModule.name[0] === '.'
                  ? path.relative(path.dirname(file), path.resolve(path.dirname(file), thisModule.name))
                  : path.relative(path.dirname(file), path.resolve(`assets/${thisModule.name}`))
      if (thisModule.pathinfo) {
        modpath += (modpath ? '/' : './') + thisModule.pathinfo.trim()
        // not included, loading dirs and having it find `index.js`
        // loading a filename w/o an extension
      }
      if (!/[.]\w+$/.test(modpath)) modpath += '.js'
      return `${prelude}${modpath.replace(/([.]mjs)$/, '.js')}`
    })
    await writeFile(file, content)
  })
}
