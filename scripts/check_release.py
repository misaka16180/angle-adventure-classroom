"""Validate public documentation links and self-contained release artifacts.

Only Python's standard library is needed. Run after scripts/build.py.
This checks packaging integrity; it does not replace browser interaction tests.
"""
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
import re
import zipfile


def local_links(text):
    links = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', text)
    links += re.findall(r'!?\[[^\]]*\]\(([^\s)]+)\)', text)
    for link in links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        yield unquote(parsed.path)


class RuntimeAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.external = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        reference = None
        if tag in ('script', 'img', 'audio', 'video', 'source'):
            reference = attrs.get('src')
        elif tag == 'link' and attrs.get('rel') == 'stylesheet':
            reference = attrs.get('href')
        if reference and not reference.startswith('data:'):
            self.external.append(reference)


def check_release(root):
    errors = []
    documents = [root/'README.md', *sorted((root/'docs').glob('*.md'))]
    for document in documents:
        for link in local_links(document.read_text(encoding='utf-8')):
            if not (document.parent/link).is_file():
                errors.append(f'{document.relative_to(root)} -> missing {link}')

    target = root/'dist'/'角度探险家.html'
    payload = target.read_bytes()
    if (root/'index.html').read_bytes() != payload:
        errors.append('Pages index.html differs from the offline HTML')
    assets = RuntimeAssets()
    assets.feed(payload.decode('utf-8'))
    if assets.external:
        errors.append(f'HTML has runtime dependencies: {assets.external}')
    if b'127.0.0.1:' in payload or b'static.blockly.com/media/' in payload:
        errors.append('HTML contains a development server or Blockly media URL')

    archive_path = root/'dist'/'角度探险家-离线课堂.zip'
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip():
            errors.append('ZIP integrity check failed')
        members = set(archive.namelist())
        required = {target.name, '教师使用指南.md', '使用说明.md', 'THIRD-PARTY-NOTICES.txt'}
        for name in required - members:
            errors.append(f'ZIP missing {name}')
        for name in members:
            if name.endswith('.md'):
                for link in local_links(archive.read(name).decode('utf-8')):
                    member = str(PurePosixPath(name).parent / link)
                    if member not in members:
                        errors.append(f'ZIP {name} -> missing {link}')
        for picture in (root/'docs'/'images').glob('*.png'):
            member = 'images/' + picture.name
            if member not in members or archive.read(member) != picture.read_bytes():
                errors.append(f'ZIP screenshot missing or stale: {member}')
        if target.name in members and archive.read(target.name) != payload:
            errors.append('ZIP contains an outdated HTML')

    for alias, original in [('angle-adventure-classroom.html', target),
                            ('angle-adventure-classroom-offline.zip', archive_path)]:
        path = root/'dist'/alias
        if not path.is_file() or path.read_bytes() != original.read_bytes():
            errors.append(f'Release attachment missing or stale: {alias}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('PASS documentation links, ZIP images, inline assets and release consistency')


if __name__ == '__main__':
    check_release(Path(__file__).resolve().parent.parent)
