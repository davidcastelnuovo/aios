const normalizePath = (path) => {
  if (!path || path === "/") return "/";
  try {
    return decodeURIComponent(path).replace(/\/$/, "") || "/";
  } catch {
    return path.replace(/\/$/, "") || "/";
  }
};

export function createRouter({ onRoute }) {
  const parseLocation = () => {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    return normalizePath(hash.split("?")[0]);
  };

  const navigate = (path, { replace = false } = {}) => {
    const target = path.startsWith("/") ? path : `/${path}`;
    const hash = `#${target}`;
    if (replace) {
      window.location.replace(hash);
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      onRoute(parseLocation());
    }
  };

  window.addEventListener("hashchange", () => onRoute(parseLocation()));
  onRoute(parseLocation());

  return { navigate, currentPath: parseLocation };
}

export function findContent(data, path) {
  const wanted = normalizePath(path);
  const matchPath = (entry) => normalizePath(entry.path) === wanted;

  const page = data.pages.find(matchPath);
  if (page) return page;

  const post = data.posts.find(matchPath);
  if (post) return post;

  if (wanted === "/") {
    return data.pages.find((p) => p.id === 2) || data.pages[0];
  }

  return null;
}

export { normalizePath };
