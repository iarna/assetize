import xyz from './xyz.mjs'

export default function top () {
  return 'hello world'
}

export function full () {
  return top() + ' ' + xyz()
}
