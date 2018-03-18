# proof-of-concept asset installer

**Please note that future work on this will happen at [npm/npm#npm-asset](https://github.com/npm/npm/tree/npm-asset), if you'd like to discuss it please drop by the #npm channel on the https://package.community Discord.**


A CLI that extracts ESM into `assets/` and transforms their import
statements from module names to paths in the asset folder.

```
$ assetize name-of-module
1 module installed.
```

To see the source for the example modules, check out `demo/1` and `demo/2`. 
To try it out, run `npm start` (which just runs `tryme.sh`)

Then checkout `http://localhost:5000/demo.html` or browse around in `assets/` to see
how things were transformed.

Loading an asset looks like:

```
<script type="module">
  import moduleName from './assets/module-name.js'
</script>
```

or

```
<script type="module" src="./assets/module-name.js"></script>
```

Which isn't super pretty, but if you only have to do it once it's not so
bad.  Imports from inside assets are translated from node-style to browser
style, including `.mjs` → `.js`.  Check out the source to the modules here:

* [@iarna/demo-esm-1](demo/1)
* [@iarna/demo-esm-2](demo/2)

Contrast with the version found in `./assets`.

Oh, and to show that these are still usable from node, the two demo modules
are dev deps of this project. Try:

```
node --experimental-modules demo.mjs
```

```
import demo from '@iarna/demo-esm-2'
console.log('IMPORTED')
console.log(demo())
```

# proof-of-concept

This is a proof of concept.  It uses probably fragile regexps to do
replacement.

# stuff remaining to be proofed

1. assetDependencies package.json section
2. saving assets to package-lock or asset-lock
3. handling version conflicts in entirely flat trees
