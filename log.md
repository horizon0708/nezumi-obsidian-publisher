

- md5
- Dry run
- Manifest save slug to detect collision
- progress bar


FuzzyMatch
fuzzySearch


# Errors

## E-0621-A - Empty response
```
error: net::ERR_EMPTY_RESPONSE
    at SimpleURLLoaderWrapper.<anonymous> (node:electron/js2c/browser_init:101:7169)
    at SimpleURLLoaderWrapper.emit (node:events:390:28
```
~~Fixed by wrapping `buildPayload` and `updateFrontmatter` in try catch...~~
(!) Actually this was NOT fixed

It seems to be upload itself failing as above functions did not emit log 

```
Upload failed TestBlog/Directory 2/Two/Two Markdown.md 
Upload failed TestBlog/Directory 2/Two/One Markdown.md
Upload failed TestBlog/Directory 3/Deeply/Nested/Image/Pasted image 20230109153028 1.png
Upload failed TestBlog/Directory 2/One/Pasted image 20230109153028 1 1.png
```