export function modelPackages(spec) {
  return spec.modelPackages ?? [{
    id: "apartment", assetStem: spec.assetStem,
    webFile: "apartment-web.glb", hdFile: "apartment-hd.glb",
  }];
}

export function packageEntityIds(spec, pack) {
  return new Set(spec.entities.map(e => e.id).filter(id =>
    (!pack.entityIds || pack.entityIds.includes(id)) &&
    !pack.excludeEntityIds?.includes(id)));
}
