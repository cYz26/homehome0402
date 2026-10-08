"""Restore byte-identical original FBX / maps from the retained ZIP for preparation.
The extracted cache is deliberately excluded from Git; packed sources remain tracked.
"""
import hashlib
import json
import pathlib
import zipfile

PACKAGE = pathlib.Path(__file__).resolve().parents[1]
ROOT = PACKAGE.parents[1]
record = json.loads((PACKAGE / 'intake.json').read_text())
archive = ROOT / record['archive']['path']
if hashlib.sha256(archive.read_bytes()).hexdigest() != record['archive']['sha256']:
    raise RuntimeError('Original archive changed')
original = PACKAGE / 'original'
expected = {str(pathlib.Path(row['path']).relative_to(original.relative_to(ROOT))): row
            for row in record['original_files']}
with zipfile.ZipFile(archive) as bundle:
    for name, row in expected.items():
        data = bundle.read(name)
        if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
            raise RuntimeError('Archive member differs: ' + name)
        target = (original / name).resolve()
        if not target.is_relative_to(original.resolve()):
            raise RuntimeError('Invalid archive member path')
        if target.exists() and target.read_bytes() != data:
            raise RuntimeError('Refusing to replace changed original: ' + str(target))
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
print('Verified / restored', len(expected), 'byte-identical original source files')
