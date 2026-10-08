def packages(spec):
    return spec.get('modelPackages', [{'id': 'apartment', 'assetStem': spec['assetStem'], 'webFile': 'apartment-web.glb', 'hdFile': 'apartment-hd.glb'}])

def entity_ids(spec, package):
    return {e['id'] for e in spec['entities'] if
            ('entityIds' not in package or e['id'] in package['entityIds']) and
            e['id'] not in package.get('excludeEntityIds', [])}
