import { useEffect, useState } from "react";
import { request } from "./api";

const resourceCache = new Map();

export function useResource(path) {
  const [state, setState] = useState(() => {
    if (resourceCache.has(path)) {
      return { data: resourceCache.get(path), loading: false, error: "" };
    }
    return { data: null, loading: true, error: "" };
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (revision === 0 && resourceCache.has(path)) {
      setState({ data: resourceCache.get(path), loading: false, error: "" });
      return;
    }

    const abort = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    request(path, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted) {
          resourceCache.set(path, data);
          setState({ data, loading: false, error: "" });
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setState({ data: null, loading: false, error: error.message });
        }
      });
    return () => abort.abort();
  }, [path, revision]);

  const reload = () => {
    resourceCache.delete(path);
    setState({ data: null, loading: true, error: "" });
    setRevision((v) => v + 1);
  };

  return { ...state, reload };
}
