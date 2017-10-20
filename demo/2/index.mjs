import demo from '@iarna/demo-esm-1'
import xyz from '@iarna/demo-esm-1/xyz.mjs'

export default function () {
  return demo().toUpperCase() + ' ' + xyz()
}

console.log('We loaded:', demo())
