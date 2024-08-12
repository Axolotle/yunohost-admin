// import type { UserInfo, UserListInfo } from '@/utils/types'
import type { Obj } from '@/types/commons'
import type { Directive } from 'vue'
import type { RequestMethod } from './api'
import appCatalog from '@/types/data/appCatalog.json'
import appManifest from '@/types/data/appManifest.json'
import appManifestInprogress from '@/types/data/appManifestInprogress.json'
import appManifestAntifeatures from '@/types/data/appManifestAntifeatures.json'
import appList from '@/types/data/appList.json'
import appInfo from '@/types/data/appInfo.json'
import appConfig from '@/types/data/appConfig.json'
import domainList from '@/types/data/domainList.json'
import domainInfo from '@/types/data/domainInfo.json'
import domainConfig from '@/types/data/domainConfig.json'
import backupList from '@/types/data/backupList.json'
import backupInfo from '@/types/data/backupInfo.json'
import hookList from '@/types/data/backupHooks.json'
import appListBackup from '@/types/data/backupApps.json'
import diagnosis from '@/types/data/diagnosis.json'
import permissionList from '@/types/data/permissionList.json'
import groupList from '@/types/data/groupList.json'
import serviceList from '@/types/data/serviceList.json'
import serviceInfo from '@/types/data/serviceInfo.json'
import serviceInfoLogs from '@/types/data/serviceInfoLogs.json'
import firewall from '@/types/data/firewall.json'
import logList from '@/types/data/logList.json'
import logInfo from '@/types/data/logInfo.json'
import migrationList from '@/types/data/migrationList.json'
import settingsConfig from '@/types/data/settingsConfig.json'

const data: Obj = {
  '/installed': { installed: true },
  '/versions': {
    yunohost: { version: '11.2.27', repo: 'stable' },
    'yunohost-admin': { version: '11.2.7', repo: 'stable' },
    moulinette: { version: '11.2.1', repo: 'stable' },
    ssowat: { version: '11.2.1.1', repo: 'stable' },
  },
  '/apps/catalog': appCatalog,
  '/apps/manifest': appManifestAntifeatures,
  '/apps': appListBackup, //appList,
  '/apps/nextcloud': appInfo,
  '/apps/nextcloud/config': appConfig,
  '/domains': domainList,
  '/domains/demo.yunohost.org': domainInfo,
  '/domains/demo.yunohost.org/config': domainConfig,
  '/domains/demo.yunohost.org/dns/suggest': 'suggestiondsfkmslkdf',
  '/users/permissions': permissionList,
  '/users/groups': groupList,
  '/backups': backupList,
  '/backups/20240806-141848': backupInfo,
  '/hooks/backup': hookList,
  '/diagnosis': diagnosis,
  '/services': serviceList,
  '/services/nginx': serviceInfo,
  '/services/nginx/log': serviceInfoLogs,
  '/firewall': firewall,
  '/logs': logList,
  '/logs/20240810-011708-app_upgrade-roundcube': logInfo,
  '/migrations': migrationList,
  '/settings': settingsConfig,
  '/users': {
    users: {
      demo: {
        username: 'demo',
        fullname: 'demo',
        mail: 'axo@demo.yunohost.org',
        'mailbox-quota': '0',
        groups: ['admins'],
      },
      testy: {
        username: 'testy',
        fullname: 'test',
        mail: 'testy@demo.yunohost.org',
        'mailbox-quota': '0',
        groups: [],
      },
    },
  },
  '/users/demo': {
    demo: {
      username: 'demo',
      fullname: 'demo',
      mail: 'axo@demo.yunohost.org',
      loginShell: '/bin/bash',
      'mail-aliases': [],
      'mail-forward': [],
      'mailbox-quota': { limit: 'Pas de quota', use: '3.0M' },
    },
  },
  '/users/testy': {
    testy: {
      username: 'testy',
      fullname: 'test',
      mail: 'testy@demo.yunohost.org',
      loginShell: '/bin/bash',
      'mail-aliases': [],
      'mail-forward': [],
      'mailbox-quota': { limit: 'Pas de quota', use: '0' },
    },
  },
}

function getData(path: string, method: RequestMethod, form: FormData) {
  if (!method || method === 'GET') return data[path]
  if (method === 'POST' && path === '/users') {
    console.log(form, form.get('username'))
    return data[`${path}/${form.get('username')}`]
  }
}

export function fetch(uri: string, options): Promise<Response> {
  return new Promise((resolve) => {
    const path = new URL('https://coucou.fr' + uri).pathname.replace(
      '/yunohost/api',
      '',
    )
    const ms = !options.method || options.method === 'GET' ? 1000 : 3000
    // const d = getValue(data, keys)
    const d = getData(path, options.method, options.body)
    console.log('fake API', path, d)
    let resp: Response
    // if (path === '/versions') {
    //   resp = new Response('', {
    //     status: 500,
    //     url: 'https://coucou.fr/coucou',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'X-Request-ID': options.headers['X-Request-ID'],
    //     },
    //   })
    // } else
    if (path === '/err') {
      resp = new Response('messagederreur', {
        status: 500,
        url: 'https://coucou.fr/coucou',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': options.headers['X-Request-ID'],
        },
      })
    } else {
      resp = new Response(JSON.stringify(d), {
        status: 200,
        url: 'https://coucou.fr/coucou',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': options.headers['X-Request-ID'],
        },
      })
    }
    setTimeout(() => resolve(resp), ms)
  })
}

// window.fetch = fetch
