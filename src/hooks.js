import { useEffect, useState } from 'react'
import { request } from './api'
export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    request(path, { signal: abort.signal }).then(data => {
      if (!abort.signal.aborted) setState({ data, loading: false, error: '' })
    }).catch(error => { if (!abort.signal.aborted) setState({ data: null, loading: false, error: error.message }) })
    return () => abort.abort()
  }, [path, revision])
  // A keyed page owns filter/page changes; reload clears old data immediately.
  const reload = () => { setState({ data: null, loading: true, error: '' }); setRevision(v => v + 1) }
  return { ...state, reload }
}
