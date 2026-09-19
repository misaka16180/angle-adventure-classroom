from pathlib import Path
import zipfile
import base64
from check_release import check_release

root=Path(__file__).resolve().parent.parent
src=root/'app'
out=root/'dist'
out.mkdir(exist_ok=True)
html=(src/'index.html').read_text(encoding='utf-8')
for css in ('style.css','blocks.css','duel.css'):
    html=html.replace(f'<link rel="stylesheet" href="{css}">','<style>\n'+(src/css).read_text(encoding='utf-8')+'\n</style>')
def inline_js(name: str) -> str:
    """Read a local script and make Blockly's small media references self-contained.

    Blockly's default bundle points at static.blockly.com for sprites and foldout
    icons.  Replacing those filename literals with data URLs keeps the classroom
    file usable from a USB drive or an air-gapped machine.  Audio remains disabled
    by the app, so the audio files do not need to be embedded.
    """
    text = (src/name).read_text(encoding='utf-8')
    if name == 'blockly.min.js':
        text = text.replace('https://static.blockly.com/media/', '').replace('var Xa="media/";', 'var Xa="";')
        for media_name, mime in {
            'sprites.svg': 'image/svg+xml',
            'foldout-icon.svg': 'image/svg+xml',
            'dropdown-arrow.svg': 'image/svg+xml',
            'delete-icon.svg': 'image/svg+xml',
            'resize-handle.svg': 'image/svg+xml',
            'handclosed.cur': 'application/octet-stream',
            'handdelete.cur': 'application/octet-stream',
            'handopen.cur': 'application/octet-stream',
        }.items():
            media_file = src/'media'/media_name
            encoded = base64.b64encode(media_file.read_bytes()).decode('ascii')
            data_url = f'data:{mime};base64,{encoded}'
            # CSS uses <<<PATH>>>/sprites.svg while SVG image hrefs use
            # pathToMedia + filename; replacing both literal forms is safe.
            text = text.replace(f'<<<PATH>>>/{media_name}', data_url)
            text = text.replace(media_name, data_url)
    return text.replace('</script','<\\/script')

for js in ('blockly.min.js','zh-hans.js','engine.js','replay.js','block-adapter.js','blockly-adapter.js','angle-lab.js','duel-model.js','duel.js','app.js'):
    html=html.replace(f'<script src="{js}"></script>','<script>\n'+inline_js(js)+'\n</script>')
target=out/'角度探险家.html'
notice = src/'THIRD-PARTY-NOTICES.txt'
if notice.exists():
    html = html.replace('</html>', '\n<!--\n'+notice.read_text(encoding='utf-8').replace('-->', '-- >')+'\n-->\n</html>')
target.write_bytes(html.encode('utf-8'))
# GitHub Pages serves the same self-contained build from the repository root.
(root/'index.html').write_bytes(target.read_bytes())
# Use stable timestamps so rebuilding the same sources produces the same ZIP.
def add_file(archive, path, name):
    entry = zipfile.ZipInfo(name, date_time=(2026, 9, 19, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_DEFLATED
    entry.external_attr = 0o644 << 16
    archive.writestr(entry, path.read_bytes())

with zipfile.ZipFile(out/'角度探险家-离线课堂.zip','w',zipfile.ZIP_DEFLATED) as z:
    add_file(z, target, target.name)
    add_file(z, root/'docs'/'TEACHER_GUIDE.md', '教师使用指南.md')
    add_file(z, root/'docs'/'使用说明.md', '使用说明.md')
    # The guide is at the ZIP root and uses images/*.png relative links.
    for picture in sorted((root/'docs'/'images').glob('*.png')):
        add_file(z, picture, 'images/' + picture.name)
    # Keep the open-source notice next to the single-file app for school IT
    # inventories and redistribution of the offline package.
    add_file(z, notice, 'THIRD-PARTY-NOTICES.txt')
# ASCII attachment names avoid GitHub normalizing Chinese upload filenames.
(out/'angle-adventure-classroom.html').write_bytes(target.read_bytes())
(out/'angle-adventure-classroom-offline.zip').write_bytes((out/'角度探险家-离线课堂.zip').read_bytes())
check_release(root)
print(f'Built {target.name}: {target.stat().st_size:,} bytes')


