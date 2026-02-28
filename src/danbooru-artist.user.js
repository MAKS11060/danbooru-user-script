// ==UserScript==
// @name         Danbooru Artist on X.com (Twitter)
// @namespace    https://danbooru.donmai.us/
// @version      1.0.2
// @description  Adds a Danbooru icon to quickly open a profile on Danbooru
// @author       MAKS11060
// @icon         https://danbooru.donmai.us/favicon.ico
// @homepage     https://github.com/MAKS11060/danbooru-user-script
// @downloadURL  https://github.com/MAKS11060/danbooru-user-script/raw/main/src/danbooru-artist.user.js
// @updateURL    https://github.com/MAKS11060/danbooru-user-script/raw/main/src/danbooru-artist.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_getResourceURL
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @resource     danbooruIcon https://danbooru.donmai.us/favicon.ico
// @connect      danbooru.donmai.us
// @run-at       document-end
// ==/UserScript==

'use strict'

const CACHE_KEY = 'danbooruCache_v2'
const ICON_CLASS = 'danbooru-icon'
const LOG_PREFIX = '[Danbooru-artist]'

let pending = new Map()

// ==================== Locals ====================
const locals = {
  openOnDanbooru: {
    en: 'Open on Danbooru',
    ru: 'Открыть на Danbooru',
  },
}

function getText(key) {
  return locals[key][navigator.language] ?? locals[key]['en']
}

// ==================== Cache ====================
function loadCache() {
  const saved = GM_getValue(CACHE_KEY, '{}')
  try {
    const obj = JSON.parse(saved)
    const cache = new Map(Object.entries(obj))
    console.log(`${LOG_PREFIX}[cache] load`, cache.size)
    return cache
  } catch (e) {
    console.log(`${LOG_PREFIX}[cache] load empty`)
    return new Map()
  }
}

function saveCache() {
  GM_setValue(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)))
}

// ==================== Find Button ====================
function findActionsContainer(nameContainer) {
  let el = nameContainer
  while (el && el !== document.body) {
    el = el.parentElement
    if (!el) break

    const lastChild = el.lastElementChild
    if (lastChild && lastChild.querySelector('button[role="button"]')) {
      return lastChild.firstElementChild || lastChild
    }
  }
  return null
}

// ==================== Main ====================
function getUsername(container) {
  const a = container.querySelector('a[href^="/"]')
  return a ? a.getAttribute('href').split('/')[1] : null
}

function checkDanbooru(username) {
  if (cache.has(username)) {
    console.log(`${LOG_PREFIX}[cache] match`, username)
    return Promise.resolve(cache.get(username))
  }

  return pending.getOrInsertComputed(username, () => {
    return new Promise((resolve) => {
      const url = new URL('https://danbooru.donmai.us/artist_urls.json')
      url.searchParams.set('only', 'artist_id')
      url.searchParams.set('search[url]', `https://x.com/${username}`)
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {'Accept': 'application/json'},
        onload: (r) => {
          if (r.status === 200) {
            try {
              const json = JSON.parse(r.responseText)
              if (Array.isArray(json) && json.length > 0 && json[0].artist_id) {
                cache.set(username, json[0].artist_id)
              } else if (Array.isArray(json) && json.length === 0) {
                cache.set(username, null)
              }
            } catch (e) {
              console.error(LOG_PREFIX, e)
            }
            saveCache()
            console.log(`${LOG_PREFIX}[cache] put`, username, cache.get(username))
          } else if (r.status === 403) { // CF block
            console.error(`${LOG_PREFIX} 403`, r)
          }
          pending.delete(username)
          resolve(cache.get(username))
        },
        onerror: () => {
          pending.delete(username)
          resolve(null)
        },
      })
    })
  })
}

function addIcon(container, artistId) {
  if (container.querySelector('.' + ICON_CLASS)) return

  const wrapper = document.createElement('span')
  wrapper.className = ICON_CLASS
  wrapper.style.marginLeft = '6px'
  wrapper.style.display = 'inline-flex'
  wrapper.style.alignItems = 'center'

  const a = document.createElement('a')
  a.href = `https://danbooru.donmai.us/artists/${artistId}`
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.title = getText('openOnDanbooru')

  const img = document.createElement('img')
  img.src = GM_getResourceURL('danbooruIcon')
  img.alt = 'Danbooru'
  img.style.width = '19px'
  img.style.height = '19px'
  img.style.verticalAlign = 'middle'

  a.appendChild(img)
  wrapper.appendChild(a)
  container.appendChild(wrapper)
}

function processAll() {
  document.querySelectorAll('div[data-testid="User-Name"]').forEach((nameContainer) => {
    const actionsContainer = findActionsContainer(nameContainer)
    if (!actionsContainer || actionsContainer.querySelector('.' + ICON_CLASS)) return

    const username = getUsername(nameContainer)
    if (!username) return

    checkDanbooru(username).then((artistId) => {
      if (artistId) {
        addIcon(actionsContainer, artistId)
      }
    })
  })
}

// ===================== Polyfill =====================
// https://github.com/tc39/proposal-upsert?tab=readme-ov-file#polyfill
Map.prototype.getOrInsertComputed ??= function(key, callbackFunction) {
  if (!this.has(key)) this.set(key, callbackFunction(key))
  return this.get(key)
}

// ==================== Entrypoint ====================
const cache = loadCache()
const observer = new MutationObserver(processAll)
observer.observe(document.body, {childList: true, subtree: true})

processAll()
window.addEventListener('load', processAll)

console.log(`%c${LOG_PREFIX} loaded!`, 'color: #ff6b9d; font-weight: bold')
