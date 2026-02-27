'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Company {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_colour: string
  member_count?: number
  created_at: string
  domains: string[]
}

interface LookupResult {
  company: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  } | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlatformAdminClient({
  userEmail,
}: {
  userEmail: string
}) {
  // ── Company list ──────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // ── Create form ───────────────────────────────────────────────────────────
  const [formName, setFormName] = useState('')
  const [formDomains, setFormDomains] = useState<string[]>([])
  const [formDomainInput, setFormDomainInput] = useState('')
  const [formLogoUrl, setFormLogoUrl] = useState('')
  const [formColour, setFormColour] = useState('#0D9488')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Email test ────────────────────────────────────────────────────────────
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{
    loading: boolean
    company: string | null
    checked: boolean
  }>({ loading: false, company: null, checked: false })
  const testDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editColour, setEditColour] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Add domain (inline) ───────────────────────────────────────────────────
  const [addDomainCompanyId, setAddDomainCompanyId] = useState<string | null>(
    null
  )
  const [addDomainInput, setAddDomainInput] = useState('')

  // ── Fetch companies ───────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform-admin/companies')
      if (!res.ok) throw new Error('Failed to load companies')
      const data: Company[] = await res.json()
      setCompanies(data)
    } catch {
      setError('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // ── Create company ────────────────────────────────────────────────────────

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formName.trim()) {
      setError('Company name is required')
      return
    }
    if (formDomains.length === 0) {
      setError('At least one email domain is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/platform-admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          domains: formDomains,
          logo_url: formLogoUrl.trim() || null,
          primary_colour: formColour.replace('#', ''),
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        const conflicts = data.conflicts?.join(', ') ?? 'unknown'
        setError(`Domain conflict: ${conflicts} already registered`)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create company')
        return
      }

      // Reset form
      setFormName('')
      setFormDomains([])
      setFormDomainInput('')
      setFormLogoUrl('')
      setFormColour('#0D9488')
      setTestEmail('')
      setTestResult({ loading: false, company: null, checked: false })
      await fetchCompanies()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  // ── Domain chip input (create form) ───────────────────────────────────────

  function handleAddDomainChip(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const domain = formDomainInput
        .replace(',', '')
        .toLowerCase()
        .trim()
      if (!domain) return
      if (!domain.includes('.') || domain.includes('@') || domain.includes(' ')) {
        setError(`Invalid domain format: "${domain}". Use format like example.com`)
        return
      }
      if (formDomains.includes(domain)) {
        setError(`Domain "${domain}" already added`)
        return
      }
      setFormDomains((prev) => [...prev, domain])
      setFormDomainInput('')
      setError(null)
    }
  }

  function handleRemoveDomainChip(index: number) {
    setFormDomains((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Email test with debounce ──────────────────────────────────────────────

  function handleTestEmailChange(value: string) {
    setTestEmail(value)
    if (testDebounce.current) clearTimeout(testDebounce.current)

    if (!value.includes('@') || !value.includes('.')) {
      setTestResult({ loading: false, company: null, checked: false })
      return
    }

    setTestResult({ loading: true, company: null, checked: false })
    testDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/company/lookup?email=${encodeURIComponent(value)}`
        )
        if (!res.ok) {
          setTestResult({ loading: false, company: null, checked: true })
          return
        }
        const data: LookupResult = await res.json()
        setTestResult({
          loading: false,
          company: data.company?.name ?? null,
          checked: true,
        })
      } catch {
        setTestResult({ loading: false, company: null, checked: true })
      }
    }, 400)
  }

  // ── Update company (edit modal) ───────────────────────────────────────────

  async function handleUpdateCompany() {
    if (!editingCompany) return
    setEditError(null)
    setEditSaving(true)

    try {
      const res = await fetch(
        `/api/platform-admin/companies/${editingCompany.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editName.trim(),
            logo_url: editLogoUrl.trim() || null,
            primary_colour: editColour.replace('#', ''),
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        setEditError(data.error ?? 'Failed to update')
        return
      }

      setEditingCompany(null)
      await fetchCompanies()
    } catch {
      setEditError('Network error')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Add domain to existing company ────────────────────────────────────────

  async function handleAddDomain(companyId: string, domain: string) {
    const clean = domain.toLowerCase().trim()
    if (!clean || !clean.includes('.') || clean.includes('@')) {
      setError(`Invalid domain format: "${clean}"`)
      return
    }

    try {
      const res = await fetch(
        `/api/platform-admin/companies/${companyId}/domains`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: clean }),
        }
      )

      if (res.status === 409) {
        const data = await res.json()
        setError(data.error ?? `Domain "${clean}" is already registered`)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to add domain')
        return
      }

      setAddDomainCompanyId(null)
      setAddDomainInput('')
      setError(null)
      await fetchCompanies()
    } catch {
      setError('Network error')
    }
  }

  // ── Remove domain from company ────────────────────────────────────────────

  async function handleRemoveDomain(companyId: string, domain: string) {
    if (
      !confirm(
        `Remove domain "${domain}"? Users with this email domain will no longer be auto-assigned to this company.`
      )
    ) {
      return
    }

    try {
      const res = await fetch(
        `/api/platform-admin/companies/${companyId}/domains/${encodeURIComponent(domain)}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const data = await res.json()
        setEditError(data.error ?? 'Failed to remove domain')
        return
      }

      // Update the editing company's domains in-place
      if (editingCompany && editingCompany.id === companyId) {
        const updated = await res.json()
        setEditingCompany({
          ...editingCompany,
          domains: updated.domains ?? editingCompany.domains.filter((d) => d !== domain),
        })
      }
      await fetchCompanies()
    } catch {
      setEditError('Network error')
    }
  }

  // ── Open edit modal ───────────────────────────────────────────────────────

  function openEditModal(company: Company) {
    setEditingCompany(company)
    setEditName(company.name)
    setEditLogoUrl(company.logo_url ?? '')
    setEditColour(`#${company.primary_colour}`)
    setEditError(null)
  }

  // ── Format date ───────────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0D7377] text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight">
            ROVA Platform Admin
          </h1>
          <span className="text-sm text-teal-100">{userEmail}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {/* ── Global error banner ──────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-red-400 hover:text-red-600"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Section 1: Registered Companies ──────────────────────────── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Registered Companies
          </h2>

          {loading ? (
            <div className="flex items-center justify-center rounded-lg border bg-white p-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0D7377] border-t-transparent" />
              <span className="ml-3 text-sm text-gray-500">
                Loading companies...
              </span>
            </div>
          ) : companies.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-500">
              No companies registered yet. Create one below.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Domains</th>
                      <th className="px-4 py-3 text-right">Members</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {companies.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        {/* Company name + logo */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-3">
                            {c.logo_url ? (
                              <img
                                src={c.logo_url}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
                                style={{
                                  backgroundColor: `#${c.primary_colour}`,
                                }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {c.name}
                            </span>
                          </div>
                        </td>

                        {/* Domains */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.domains.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-[#0D7377]"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Members */}
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">
                          {c.member_count ?? 0}
                        </td>

                        {/* Created */}
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {formatDate(c.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(c)}
                              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            {addDomainCompanyId === c.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={addDomainInput}
                                  onChange={(e) =>
                                    setAddDomainInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddDomain(c.id, addDomainInput)
                                    }
                                    if (e.key === 'Escape') {
                                      setAddDomainCompanyId(null)
                                      setAddDomainInput('')
                                    }
                                  }}
                                  placeholder="example.com"
                                  className="w-32 rounded border px-2 py-1 text-xs focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                                  autoFocus
                                />
                                <button
                                  onClick={() =>
                                    handleAddDomain(c.id, addDomainInput)
                                  }
                                  className="rounded bg-[#0D7377] px-2 py-1 text-xs text-white hover:bg-[#0B6163]"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => {
                                    setAddDomainCompanyId(null)
                                    setAddDomainInput('')
                                  }}
                                  className="px-1 text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAddDomainCompanyId(c.id)
                                  setAddDomainInput('')
                                }}
                                className="rounded border border-[#0D7377] px-3 py-1 text-xs font-medium text-[#0D7377] hover:bg-teal-50"
                              >
                                + Domain
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Register New Company ──────────────────────────── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Register New Company
          </h2>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <form onSubmit={handleCreateCompany} className="space-y-5">
              {/* Company name */}
              <div>
                <label
                  htmlFor="company-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                />
              </div>

              {/* Email domains (tag input) */}
              <div>
                <label
                  htmlFor="domain-input"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email domains <span className="text-red-500">*</span>
                </label>
                <div className="rounded-lg border border-gray-300 px-3 py-2 focus-within:border-[#0D7377] focus-within:ring-1 focus-within:ring-[#0D7377]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {formDomains.map((domain, i) => (
                      <span
                        key={domain}
                        className="inline-flex items-center gap-1 rounded-full bg-[#0D7377] px-2.5 py-0.5 text-xs font-medium text-white"
                      >
                        {domain}
                        <button
                          type="button"
                          onClick={() => handleRemoveDomainChip(i)}
                          className="ml-0.5 text-teal-200 hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    <input
                      id="domain-input"
                      type="text"
                      value={formDomainInput}
                      onChange={(e) => setFormDomainInput(e.target.value)}
                      onKeyDown={handleAddDomainChip}
                      placeholder={
                        formDomains.length === 0
                          ? 'Type a domain and press Enter (e.g. acme.com)'
                          : 'Add another domain...'
                      }
                      className="min-w-[200px] flex-1 border-none p-0 text-sm outline-none focus:ring-0"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Press Enter or comma to add each domain
                </p>
              </div>

              {/* Logo URL */}
              <div>
                <label
                  htmlFor="logo-url"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Logo URL{' '}
                  <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <input
                  id="logo-url"
                  type="url"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                />
              </div>

              {/* Brand colour */}
              <div>
                <label
                  htmlFor="brand-colour"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Brand colour{' '}
                  <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-colour"
                    type="color"
                    value={formColour}
                    onChange={(e) => setFormColour(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={formColour}
                    onChange={(e) => setFormColour(e.target.value)}
                    placeholder="#0D9488"
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                  />
                  <div
                    className="h-9 w-9 rounded-full border"
                    style={{ backgroundColor: formColour }}
                  />
                </div>
              </div>

              {/* ── Test panel ──────────────────────────────────────────── */}
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <label
                  htmlFor="test-email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Test an email address
                </label>
                <input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => handleTestEmailChange(e.target.value)}
                  placeholder="john@acme.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                />
                {testResult.loading && (
                  <p className="mt-2 text-sm text-gray-500">Checking...</p>
                )}
                {testResult.checked && !testResult.loading && (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      testResult.company ? 'text-green-700' : 'text-gray-500'
                    }`}
                  >
                    {testResult.company
                      ? `Would be assigned to ${testResult.company}`
                      : 'No match -- domain not registered'}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0D7377] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#0B6163] disabled:opacity-50"
              >
                {saving ? 'Registering...' : 'Register Company'}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Company
              </h3>
              <button
                onClick={() => setEditingCompany(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {editError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Company name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={editLogoUrl}
                  onChange={(e) => setEditLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                />
              </div>

              {/* Brand colour */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Brand colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                  />
                </div>
              </div>

              {/* Current domains */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Domains
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {editingCompany.domains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-[#0D7377]"
                    >
                      {d}
                      {editingCompany.domains.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveDomain(editingCompany.id, d)
                          }
                          className="ml-0.5 text-teal-400 hover:text-red-500"
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {/* Add domain inline */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={
                      addDomainCompanyId === editingCompany.id
                        ? addDomainInput
                        : ''
                    }
                    onChange={(e) => {
                      setAddDomainCompanyId(editingCompany.id)
                      setAddDomainInput(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddDomain(editingCompany.id, addDomainInput)
                      }
                    }}
                    placeholder="newdomain.com"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#0D7377] focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAddDomain(editingCompany.id, addDomainInput)
                    }
                    className="rounded-lg border border-[#0D7377] px-3 py-1.5 text-sm font-medium text-[#0D7377] hover:bg-teal-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCompany}
                disabled={editSaving}
                className="rounded-lg bg-[#0D7377] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0B6163] disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
