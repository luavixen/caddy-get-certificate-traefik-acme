import { type Server } from 'bun'
import { expect } from 'bun:test'

console.log('caddy-get-certificate-traefik-acme v0.0.1')

const storagePaths: string[] = (() => {
  const path = process.env.ACME_STORAGE_PATH
  if (path == null) {
    console.error('ACME_STORAGE_PATH environment variable not set')
    process.exit(1)
  }

  const paths = path.split(':').filter(path => path.length > 0)
  if (paths.length === 0) {
    console.error('ACME_STORAGE_PATH environment variable empty')
    process.exit(1)
  }

  return paths
})()

interface Storage {
  [key: string]: StorageEntry
}

interface StorageEntry {
  Certificates: StorageCertificate[]
}

interface StorageCertificate {
  domain: {
    main: string
    sans?: string[]
  }
  certificate: string
  key: string
}

async function readStorageFile(path: string): Promise<Storage> {
  const file = Bun.file(path, { type: 'application/json' })

  let text
  try {
    text = await file.text()
  } catch (cause) {
    throw new Error(`ACME storage file not found "${path}"`, { cause })
  }

  let storage
  try {
    storage = JSON.parse(text)
  } catch (cause) {
    throw new Error(`ACME storage invalid JSON "${path}"`, { cause })
  }

  try {
    expect(storage).toBeObject()
    for (const storageEntryKey of Object.keys(storage)) {
      expect(storageEntryKey.length).toBeGreaterThan(0)
      const storageEntry = storage[storageEntryKey]
      expect(storageEntry).toBeObject()
      expect(storageEntry.Certificates).toBeArray()
      expect(storageEntry.Certificates).not.toBeEmpty()
      for (const certificate of storageEntry.Certificates) {
        expect(certificate).toBeObject()
        expect(certificate.domain).toBeObject()
        expect(certificate.domain.main).toBeString()
        if (certificate.domain.sans != null) {
          expect(certificate.domain.sans).toBeArray()
          for (const domain of certificate.domain.sans) {
            expect(domain).toBeString()
          }
        }
        expect(certificate.certificate).toBeString()
        expect(certificate.key).toBeString()
      }
    }
  } catch (cause) {
    throw new Error(`ACME storage invalid "${path}"`, { cause })
  }

  return storage as Storage
}

function decodePemFromStorageCertificate({ certificate, key }: StorageCertificate): string {
  return atob(certificate) + '\n' + atob(key) + '\n'
}

interface Certificate {
  domains: string[]
  pem: string
}

function formatDomain(domain: string): string {
  return domain.trim().toLowerCase()
}

function collectCertificates(storage: Storage): Certificate[] {
  return Object.values(storage).flatMap(entry => entry.Certificates)
    .map(certificate => {
      let domains = []
      if (certificate.domain.main) domains.push(certificate.domain.main)
      if (certificate.domain.sans) domains.push(...certificate.domain.sans)
      domains = domains.map(formatDomain)
      return {
        domains,
        pem: decodePemFromStorageCertificate(certificate)
      }
    })
}

function findCertificateForDomain(certificates: Certificate[], domain: string): Certificate | null {
  domain = formatDomain(domain)
  return certificates.find(certificate => certificate.domains.includes(domain)) || null
}

async function retrieveAllCertificates(): Promise<Certificate[]> {
  const storages = await Promise.all(storagePaths.map(readStorageFile))
  const certificates = storages.flatMap(collectCertificates)

  console.log(`Loaded ${certificates.length} certificates from ${storages.length} storages`)
  console.log('Loaded domains:', certificates.flatMap(certificate => certificate.domains).join(', '))

  return certificates
}

const server = Bun.serve({
  fetch: async function (this: Server, request: Request): Promise<Response> {
    console.log('Request:', request.method, request.url)

    if (request.method !== 'GET') {
      console.warn('Method not allowed')
      return new Response(null, { status: 405 })
    }

    const url = new URL(request.url)
    const domain = url.searchParams.get('server_name')

    if (domain == null) {
      console.warn('Missing "server_name" query parameter')
      return new Response(null, { status: 400 })
    }

    const certificates = await retrieveAllCertificates()
    const certificate = findCertificateForDomain(certificates, domain!)

    if (certificate == null) {
      console.warn('Certificate not found for domain:', domain)
      return new Response(null, { status: 404 })
    } else {
      console.log('Certificate served for domain:', domain)
      return new Response(certificate.pem)
    }
  }
})

console.log(`Listening at ${server.url}`)
