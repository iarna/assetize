'use strict'
const system = require('@perl/system')
const qx = require('@perl/qx')
const Bluebird = require('bluebird')
const fs = require('fs')
const unlink = Bluebird.promisify(fs.unlink)
const readFile = Bluebird.promisify(fs.readFile)
const writeFile = Bluebird.promisify(fs.writeFile)
const rename = Bluebird.promisify(fs.rename)
const mkdirp = Bluebird.promisify(require('mkdirp'))
const rimraf = Bluebird.promisify(require('rimraf'))
const glob = Bluebird.promisify(require('glob'))
const yargs = require('@iarna/cli')(main)
  .usage('assetize [<modules…>]')
  .help()

async function main (opts, name) {
  if (name) {
    return installModule(opts._)
  } else {
    yargs.showHelp()
  }
}

async function installModule (modules) {
  await Bluebird.map(modules, async name => {
    let packument = JSON.parse(await qx`npm show ${name} --json`)
    if (Array.isArray(packument)) packument = packument[0]
    const tarball = await qx`npm pack "${name}"`
    await Bluebird.resolve(installFromTarball(packument, tarball)).finally(() => unlink(tarball))
  })
  console.log(`${modules.length} module${modules.length !== 1 ? 's' : ''} installed.`)
}

function parseReq (name) {
  const matched = name.match(/^([.]|(?:[@][^/]+[/])?[^@/]+)(?:[/]([^@]+))?$/)
  return {
    name: matched[1],
    pathinfo: matched[2]
  }
}

async function installFromTarball (packument, tarball) {
  await rimraf(`assets/${packument.name}`)
  await mkdirp(`assets/${packument.name}`)
  await system(`tar xf "${tarball}" --strip-components 1 -C "assets/${packument.name}"`)
  const mjs = await glob(`assets/${packument.name}/**/*.mjs`)
  await Bluebird.map(mjs, file => rename(file, file.replace(/[.]mjs$/, '.js')))
  const js = await glob(`assets/${packument.name}/**/*.js`)
  await Bluebird.map(js, async file => {
    let content = await readFile(file, 'utf8')
    content = content.replace(/(import.*from.*['"])([A-Za-z@.][-A-Za-z0-9_/]+[^"']*)/g, (match, prelude, spec) => {
      const thisModule = parseReq(spec)
      let path = thisModule.name === '.' ? './' : '../../' + thisModule.name + '/'
      if (thisModule.pathinfo) {
        path += thisModule.pathinfo
        // not included, loading dirs and having it find `index.js`
        // loading a filename w/o an extension
      } else {
        path += 'index.js'
      }
      return `${prelude}${path.replace(/([.]mjs)$/, '.js')}`
    })
    await writeFile(file, content)
  })
}
