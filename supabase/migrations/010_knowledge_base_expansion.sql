-- ============================================================
-- Knowledge Base Expansion — Migration 010
-- 
-- Adds 50 real-world user questions verified against the
-- FileShare codebase. All facts (limits, formats, behaviour)
-- are confirmed from src/lib/utils.ts, API routes, and
-- existing application logic.
--
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- ============================================================

INSERT INTO public.assistant_knowledge (category, title, content, keywords)
VALUES

-- ── UPLOADING ────────────────────────────────────────────────────────────────

('uploading', 'Can I upload multiple files at once?',
'Yes. You can select multiple files at once using the file browser, or drag and drop several files together onto the upload area. Each file gets its own share link. To share multiple files under one link, create a folder (collection) and upload the files into it.',
ARRAY['multiple files', 'batch upload', 'upload many', 'drag multiple', 'several files']),

('uploading', 'Can I upload a folder?',
'You can create a collection (folder) on your dashboard and upload files into it. The collection gets a single shareable link. Direct folder drag-and-drop from your file system uploads the files inside it individually.',
ARRAY['upload folder', 'folder upload', 'directory', 'upload directory']),

('uploading', 'Why did my upload fail halfway?',
'Large files are uploaded in multiple parts. If your connection drops mid-upload, the upload fails. Refresh the page and try again. Make sure your internet connection is stable. For very large files, a wired connection is more reliable than Wi-Fi.',
ARRAY['upload failed', 'upload error', 'failed halfway', 'upload stopped', 'connection dropped', 'retry upload']),

('uploading', 'Is there a file size limit?',
'The maximum size per file is 10 GB. Guest users (not logged in) also have a daily total upload limit of 5 GB per IP address. Logged-in users have a total storage quota of 50 GB across all their files.',
ARRAY['file size limit', 'max file size', '10gb', 'size limit', 'how big', 'large file limit']),

('uploading', 'Can I upload video files?',
'Yes. FileShare supports MP4, WebM, MKV (Matroska), MOV (QuickTime), AVI, 3GP, MPEG, and OGG video files up to 10 GB each. After uploading, the share page shows an inline video player for supported formats.',
ARRAY['video upload', 'mp4', 'video file', 'mkv', 'mov', 'upload video', 'video player']),

('uploading', 'Can I upload audio files?',
'Yes. Supported audio formats include MP3, WAV, AAC, FLAC, OGG, and WebM audio. After uploading, the share page shows an audio player so recipients can listen before downloading.',
ARRAY['audio upload', 'mp3', 'audio file', 'music', 'wav', 'flac', 'upload audio']),

('uploading', 'Can I upload executable files like EXE or APK?',
'Yes. FileShare accepts executable files including EXE, APK, DMG, DEB, RPM, ISO, JAR, and other application formats up to 10 GB. Files are scanned for known executable signatures after upload as a security measure.',
ARRAY['exe', 'apk', 'executable', 'dmg', 'install file', 'app file', 'jar', 'iso']),

('uploading', 'Can I upload ZIP or archive files?',
'Yes. ZIP, 7z, RAR, TAR, GZ, and XZ archive files are all supported, up to 10 GB each.',
ARRAY['zip', 'archive', 'rar', '7z', 'tar', 'compress', 'compressed file']),

('uploading', 'Why is my upload speed slow?',
'Upload speed depends entirely on your internet connection. FileShare uses Cloudflare R2 storage with global edge servers, so the upload path is as fast as your connection allows. For slow connections, try uploading smaller files or during off-peak hours.',
ARRAY['slow upload', 'upload speed', 'upload taking long', 'why slow', 'fast upload']),

('uploading', 'Does FileShare compress my files?',
'No. FileShare stores your files exactly as you upload them without any compression or modification. The file the recipient downloads is identical to the one you uploaded.',
ARRAY['compress', 'compression', 'file quality', 'original file', 'unchanged', 'lossless']),

('uploading', 'Can I set an expiry date when uploading?',
'Yes. During upload you can choose: 1 hour, 24 hours, 7 days, 30 days, or Never. Guest users (not logged in) can choose up to 7 days maximum. The "Never" and "30 days" options require a free account.',
ARRAY['expiry date', 'set expiry', 'expiry options', 'link duration', 'how long link works']),

('uploading', 'Can I add a password during upload?',
'Yes. In the upload options, type a password in the Password field before starting the upload. The password is hashed securely — even FileShare staff cannot see it. Recipients must enter the password to download.',
ARRAY['add password', 'password upload', 'protect upload', 'password before upload', 'set password']),

('uploading', 'Can I limit how many times a file can be downloaded?',
'Yes. In the upload options, set a "Max downloads" number between 1 and 1000. Once that many downloads happen, the link stops working permanently.',
ARRAY['max downloads', 'download limit', 'limit downloads', 'one time download', 'download count']),

-- ── DOWNLOADING ──────────────────────────────────────────────────────────────

('downloading', 'The download link expired — can I get the file back?',
'No. When a link expires, the file is permanently deleted from storage. You will need to ask the sender to upload the file again and share a new link.',
ARRAY['expired link', 'link expired', 'download expired', 'can i recover', 'file deleted after expiry']),

('downloading', 'Can I preview a file before downloading?',
'Yes. Images, PDFs, videos, and audio files show an inline preview on the share page before you download. Other file types show a file information card instead.',
ARRAY['preview', 'view before download', 'preview file', 'inline preview', 'see file', 'watch before download']),

('downloading', 'Is there a download speed limit?',
'No. Downloads are served directly from Cloudflare R2 with no speed cap. Your download speed is limited only by your internet connection.',
ARRAY['download speed', 'slow download', 'download limit', 'speed cap', 'bandwidth']),

('downloading', 'Can I download without an account?',
'Yes. Anyone with the share link can download the file. No account or login is required. The only exception is if the file is password-protected — you will need the password.',
ARRAY['download without account', 'no login download', 'anonymous download', 'download guest']),

('downloading', 'The file downloaded but it is corrupted',
'This can happen if the download was interrupted. Try downloading again using the same link. If the file is still corrupted, the original upload may have been incomplete — ask the sender to upload again.',
ARRAY['corrupted file', 'corrupt download', 'download broken', 'file damaged', 'cant open file']),

('downloading', 'Can I resume a paused download?',
'This depends on your browser and download manager. FileShare generates signed download URLs from Cloudflare R2, which support HTTP range requests. Most modern browsers and download managers can resume interrupted downloads.',
ARRAY['resume download', 'pause download', 'interrupted download', 'continue download', 'partial download']),

('downloading', 'Why does the download link say it has reached the download limit?',
'The person who uploaded the file set a maximum number of downloads. That limit has been reached and the link is now permanently inactive. Ask the sender to upload the file again without a download limit, or with a higher limit.',
ARRAY['download limit reached', 'max downloads reached', 'link inactive', 'too many downloads', 'exceeded limit']),

('downloading', 'How do I download all files in a shared folder?',
'On the collection (folder) share page, click the Download All as ZIP button. All files in the folder are bundled into a single ZIP file and downloaded at once.',
ARRAY['download all', 'download folder', 'zip download', 'bulk download', 'download collection', 'all files zip']),

-- ── SHARING ──────────────────────────────────────────────────────────────────

('sharing', 'Can I share a file without the recipient needing an account?',
'Yes. Recipients never need an account or login to download a file. Just send them the share link or QR code.',
ARRAY['share without account', 'recipient no login', 'send to anyone', 'no signup to download']),

('sharing', 'How does the QR code work?',
'After uploading, a QR code is generated alongside the share link. Anyone who scans it with their phone camera is taken directly to the download page. It is useful for sharing files in person or on a printed document.',
ARRAY['qr code', 'scan qr', 'qr code share', 'phone scan', 'barcode']),

('sharing', 'Can I share a file on WhatsApp or social media?',
'Yes. Copy the share link and paste it into WhatsApp, Telegram, Instagram DMs, Twitter, email, or any other messaging platform. The link works on any device with a browser.',
ARRAY['whatsapp', 'social media', 'telegram share', 'send via', 'instagram', 'email link', 'copy link']),

('sharing', 'Can I edit or update a file after sharing?',
'No. Once a file is uploaded, it cannot be replaced or edited. If you need to share an updated version, upload the new file and share the new link. You can delete the old link from your dashboard if you are logged in.',
ARRAY['edit file', 'update file', 'replace file', 'change uploaded file', 'modify after upload']),

('sharing', 'Can I see who downloaded my file?',
'You can see the total download count on your dashboard for each file. FileShare does not track or display individual downloader identities or IP addresses.',
ARRAY['who downloaded', 'download tracking', 'see downloads', 'download count', 'analytics', 'track downloads']),

('sharing', 'Can I share a direct download link that skips the download page?',
'The share link goes to the FileShare download page first. This is intentional — it allows password protection, download counting, expiry checks, and the preview to work correctly before the download begins.',
ARRAY['direct download link', 'skip download page', 'direct link', 'bypass page', 'force download']),

('sharing', 'How many people can download my file at the same time?',
'There is no concurrent download limit. Many people can download the same file simultaneously. The download is served from Cloudflare global infrastructure.',
ARRAY['simultaneous downloads', 'concurrent downloads', 'how many people', 'multiple downloads', 'at the same time']),

-- ── FOLDERS / COLLECTIONS ────────────────────────────────────────────────────

('folders', 'How do I create a folder?',
'Log in to your dashboard and click the "New Folder" button (folder icon with a plus sign) in the left sidebar. Give it a name and click Create. You can then upload files into it or move existing files into it.',
ARRAY['create folder', 'new folder', 'make folder', 'collection', 'organise files']),

('folders', 'Can I move a file into a folder after uploading?',
'Yes. On your dashboard, find the file and use the move option to assign it to a collection. The file will then appear under that folder.',
ARRAY['move file', 'move to folder', 'assign folder', 'add to collection', 'organise']),

('folders', 'Can guests (non-logged-in users) create folders?',
'Yes. Guest users can create collections and upload files into them. However, guest collections cannot be managed after the session ends since there is no account to log back into. Creating an account lets you manage your folders at any time.',
ARRAY['guest folder', 'anonymous folder', 'folder without account', 'guest collection']),

('folders', 'What happens to files if I delete a folder?',
'The folder is deleted but all files inside it remain in your All Files view. No file data is lost when you delete a folder.',
ARRAY['delete folder', 'folder deleted', 'files after delete', 'remove collection', 'what happens files']),

-- ── EXPIRY ───────────────────────────────────────────────────────────────────

('expiry', 'What happens to my file when the link expires?',
'The file is automatically deleted from storage and the share link stops working permanently. There is no way to recover it after expiry. Download the file yourself before the expiry date if you need to keep it.',
ARRAY['file deleted after expiry', 'what happens expiry', 'link stops working', 'auto delete', 'expired file']),

('expiry', 'Can I extend the expiry of an existing link?',
'No. The expiry time is set at upload and cannot be changed afterwards. If you need a longer link, upload the file again with a different expiry setting.',
ARRAY['extend expiry', 'change expiry', 'update expiry', 'longer link', 'edit expiry']),

('expiry', 'What is the shortest expiry time available?',
'The shortest option is 1 hour. After 1 hour the link stops working and the file is deleted.',
ARRAY['shortest expiry', '1 hour', 'one hour link', 'minimum expiry', 'temporary link']),

('expiry', 'Does the expiry reset when someone downloads the file?',
'No. The expiry clock starts from the moment you upload the file and counts down regardless of whether anyone downloads it.',
ARRAY['expiry reset', 'download reset expiry', 'does expiry reset', 'expiry timer']),

-- ── ACCOUNT ──────────────────────────────────────────────────────────────────

('account', 'What are the benefits of creating an account?',
'With a free account you get: a personal dashboard to manage all your files, the ability to delete files at any time, expiry options up to 30 days or never, a higher storage quota (50 GB total vs 5 GB/day for guests), and folder management.',
ARRAY['account benefits', 'why create account', 'free account', 'account vs guest', 'advantages']),

('account', 'Can I sign in with Google?',
'Yes. Click "Login / Sign Up" in the navigation bar and select "Continue with Google". Your Google account email must match the one you want to use for FileShare.',
ARRAY['google login', 'google signin', 'sign in google', 'oauth google', 'google account']),

('account', 'Can I change my email address?',
'Email changes are handled through Supabase Auth. Currently there is no self-service email change option in the dashboard. Contact support if you need to update your email.',
ARRAY['change email', 'update email', 'new email', 'email change']),

('account', 'Can I delete my account?',
'Account deletion is not currently available as a self-service option. Contact support via the ticket system and we will delete your account and all associated files.',
ARRAY['delete account', 'remove account', 'close account', 'deactivate account']),

('account', 'What is my storage quota?',
'Logged-in users have a total storage quota of 50 GB across all active files. Guest users have a daily upload limit of 5 GB per IP address. Your current storage usage is shown on your dashboard.',
ARRAY['storage quota', 'how much storage', '50gb', 'storage limit', 'usage', 'storage used']),

('account', 'I cannot log in to my account',
'Make sure you are using the correct email and password. If you signed up with Google, use the Google sign-in button instead of email/password. If you forgot your password, use the password reset link on the login screen.',
ARRAY['cant login', 'login problem', 'cant sign in', 'login error', 'access denied', 'wrong password']),

-- ── SECURITY ─────────────────────────────────────────────────────────────────

('security', 'Is my file encrypted?',
'Files are transferred over HTTPS (TLS encryption in transit) and stored on Cloudflare R2 which encrypts data at rest. FileShare does not apply additional end-to-end encryption on top of this. If you need extra privacy, encrypt the file yourself before uploading.',
ARRAY['encryption', 'encrypted', 'is it secure', 'tls', 'https', 'data at rest', 'e2e encryption']),

('security', 'Can FileShare staff access my files?',
'Technically, files are stored on Cloudflare R2 and can be accessed by the FileShare administrator. FileShare does not inspect file contents unless required for safety (executable detection scan). For sensitive files, encrypt them before uploading.',
ARRAY['staff access', 'admin access', 'can fileshare see my files', 'privacy', 'who can access']),

('security', 'Is the share link guessable?',
'Share links contain an 8-character token generated from a random alphanumeric alphabet (a-z, 0-9), giving 36^8 ≈ 2.8 trillion possible combinations. The link is effectively unguessable by brute force.',
ARRAY['link guessable', 'link security', 'random link', 'brute force', 'link safe', 'token security']),

('security', 'What happens if someone shares my file link publicly?',
'Anyone with the link can download the file. If you did not want the file to be public, you should have added a password before uploading. FileShare cannot retroactively add a password. Delete the file from your dashboard (requires login) and re-upload with a password.',
ARRAY['link shared publicly', 'public link', 'link leaked', 'too many people', 'revoke link']),

('security', 'Does FileShare scan files for viruses?',
'FileShare performs a lightweight magic-byte scan after upload to detect known executable file signatures (Windows PE, ELF, Mach-O) that have been disguised as other file types. This is a basic safety check, not a full antivirus scan. Do not rely on FileShare as your only malware protection.',
ARRAY['virus scan', 'antivirus', 'malware', 'scan files', 'security scan', 'safe files', 'infected']),

('security', 'Is FileShare GDPR compliant?',
'FileShare stores minimal data: the file itself, its metadata (name, size, type), and optionally the uploader account. Files are automatically deleted after expiry. For specific GDPR enquiries, contact support via the ticket system.',
ARRAY['gdpr', 'data protection', 'privacy law', 'data compliance', 'personal data', 'europe']),

-- ── TROUBLESHOOTING ──────────────────────────────────────────────────────────

('troubleshooting', 'The upload progress bar is stuck at 0%',
'This usually means the file has not started uploading yet. Check your browser console for errors. Common causes are: the file type is not supported, the file size exceeds 10 GB, or a browser extension is blocking the upload request. Try a different browser.',
ARRAY['progress stuck', 'upload 0%', 'not starting', 'upload not moving', 'progress bar stuck']),

('troubleshooting', 'I uploaded a file but cannot find the share link',
'The share link appears immediately after upload completes. If you accidentally closed the browser tab, the link is gone for guest uploads. If you were logged in, go to your dashboard — the file will be listed there with its share link.',
ARRAY['lost share link', 'cant find link', 'link disappeared', 'closed tab', 'where is my link']),

('troubleshooting', 'My file uploaded but the recipient gets "File not found"',
'This can happen if the upload did not complete fully (the confirmation step failed). Go to your dashboard and check if the file is listed there. If it is not, the upload was incomplete — upload the file again.',
ARRAY['file not found recipient', 'upload incomplete', 'confirmation failed', 'recipient error', '404 after upload']),

('troubleshooting', 'The share page is showing a loading spinner and not loading',
'Try refreshing the page. If it persists, the file may have been deleted or the link may be invalid. Clear your browser cache and try again.',
ARRAY['page not loading', 'loading spinner', 'share page stuck', 'page not working', 'blank page']),

('troubleshooting', 'I cannot copy the share link on mobile',
'Tap and hold the link to get the copy option, or tap the copy button next to the link. On iOS Safari, you may need to allow clipboard access. The QR code is an alternative — scan it with another device instead.',
ARRAY['copy link mobile', 'cant copy mobile', 'ios copy', 'android copy', 'clipboard mobile']),

('troubleshooting', 'The video preview is not playing',
'Video previews work for MP4, WebM, and OGG formats. If the video does not play, your browser may not support that video codec. Try downloading the file and playing it in a local media player like VLC.',
ARRAY['video not playing', 'video preview broken', 'cant play video', 'video error', 'codec']),

('troubleshooting', 'I am getting a "Too many requests" error',
'FileShare has rate limits to prevent abuse. The download limit is 500 per hour per IP. The chat assistant limit is 10 messages per minute. Wait a few minutes and try again. If you need higher limits, contact support.',
ARRAY['too many requests', 'rate limit', '429 error', 'blocked', 'throttled', 'slow down']),

('troubleshooting', 'The file I downloaded has a different name than expected',
'FileShare sanitises file names on upload — special characters, spaces, and path separators are replaced with underscores. The content of the file is unchanged.',
ARRAY['wrong file name', 'filename changed', 'name different', 'underscore filename', 'sanitised name']),

-- ── GENERAL ──────────────────────────────────────────────────────────────────

('general', 'Is FileShare really free?',
'Yes. FileShare is completely free to use. There are no paid plans, no subscriptions, and no payment required. Guest uploads, downloads, folder sharing, password protection, and QR codes are all free.',
ARRAY['free', 'cost', 'pricing', 'paid plan', 'subscription', 'is it free', 'price']),

('general', 'What browsers does FileShare support?',
'FileShare works on all modern browsers including Chrome, Firefox, Safari, Edge, and Brave. It also works on mobile browsers on Android and iOS. Internet Explorer is not supported.',
ARRAY['browser support', 'chrome', 'firefox', 'safari', 'mobile browser', 'edge', 'which browser']),

('general', 'Can I use FileShare on my phone?',
'Yes. The FileShare website is fully responsive and works on Android and iOS. You can upload from your phone gallery or file manager, and download files directly to your phone.',
ARRAY['mobile', 'phone', 'smartphone', 'android', 'ios', 'iphone', 'tablet', 'mobile upload']),

('general', 'Is there a FileShare mobile app?',
'There is no dedicated mobile app. The website works well on mobile browsers and can be added to your home screen as a Progressive Web App on most mobile browsers.',
ARRAY['mobile app', 'ios app', 'android app', 'app store', 'play store', 'native app']),

('general', 'How is FileShare different from Google Drive or Dropbox?',
'FileShare is designed for quick one-time sharing — no account needed, instant links, automatic expiry. It is not a cloud storage service for long-term file management. For permanent storage and collaboration, Google Drive or Dropbox are better suited.',
ARRAY['google drive', 'dropbox', 'comparison', 'vs google drive', 'difference', 'alternative', 'wetransfer']),

('general', 'Does FileShare work in all countries?',
'Yes. FileShare is served via Cloudflare global infrastructure, so it works from virtually any country. Download speeds depend on your local internet connection.',
ARRAY['countries', 'global', 'international', 'works in my country', 'region', 'blocked country']),

('general', 'Can I use FileShare for business or commercial use?',
'Yes. FileShare can be used for business file sharing. There are no restrictions on commercial use. For high-volume business use, the free tier limits (10 GB per file, 50 GB account quota) apply.',
ARRAY['business use', 'commercial', 'company', 'work', 'professional', 'enterprise'])

ON CONFLICT DO NOTHING;
