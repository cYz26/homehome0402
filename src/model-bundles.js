// Every package belongs to one versioned scene; no package is optional.
export function modelBundles(manifest) {
  const paths = [manifest.model, ...(manifest.additionalModels ?? []).map(p => p.model)];
  if (paths.some(p => !p) || new Set(paths).size !== paths.length)
    throw Error("Invalid model package manifest");
  return paths.map(path => {
    const asset = manifest.assets.find(a => a.path === path);
    if (!asset?.sha256 || !asset.bytes) throw Error(`Missing model digest: ${path}`);
    return { path, asset };
  });
}

export function highDefinitionManifest(manifest) {
  return { ...manifest, model: manifest.rawModel,
    additionalModels: (manifest.additionalModels ?? []).map(p => ({ ...p, model: p.rawModel })) };
}
