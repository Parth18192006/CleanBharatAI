import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Sparkles,
  Shield,
  User,
  LogOut,
  AlertCircle,
  Clock,
  CheckCircle2,
  MapPin,
  Search,
  RefreshCw,
  Camera,
  Upload,
  X,
  ChevronRight,
  Eye,
  Building2,
  PhoneCall,
  ArrowRight,
  Menu,
  Info,
  Check,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import './App.css'

const API = 'http://127.0.0.1:8000'

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('cleanbharat_user') || 'null')
  } catch {
    return null
  }
}

function readToken() {
  return localStorage.getItem('cleanbharat_token') || ''
}

async function apiRequest(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) }

  if (token) headers.Authorization = `Bearer ${token}`

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  let response

  try {
    response = await fetch(`${API}${path}`, { ...options, headers })
  } catch {
    throw new Error('Unable to connect to backend server. Please verify the FastAPI service is running.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || `Request failed (${response.status})`
    )
  }

  return data
}

function formatReport(report) {
  const description = report.description || ''
  const locationMatch = description.match(/^Location:\s*(.+)$/m)
  const cleanDescription = description
    .replace(/^Location:.*(?:\n|$)/m, '')
    .trim()

  const rawStatus = String(report.status || 'open').toLowerCase()
  const status =
    rawStatus === 'resolved' ? 'Resolved' :
    rawStatus === 'assigned' ? 'Assigned' : 'Open'

  return {
    id: report.complaint_id,
    title: report.title,
    location: locationMatch?.[1] || (
      report.latitude && report.latitude !== '0' &&
      report.latitude !== 'Not provided'
        ? `${report.latitude}, ${report.longitude || ''}`
        : 'Location landmark noted'
    ),
    rawLatitude: report.latitude && report.latitude !== '0' ? report.latitude : null,
    rawLongitude: report.longitude && report.longitude !== '0' ? report.longitude : null,
    description: cleanDescription,
    status,
    date: report.created_at
      ? new Date(report.created_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : 'Saved in registry',
    wasteType: report.waste_type || '',
    photoUrl: report.photo_url || '',
    userId: report.user_id,
  }
}

const COMMON_WASTE_CATEGORIES = [
  'Plastic Waste',
  'Cardboard & Paper',
  'Organic / Food Waste',
  'Glass Waste',
  'Metal Scrap',
  'Hazardous / E-Waste',
  'Mixed Solid Waste',
  'Construction Debris',
  'Other / Unsorted'
]

function App() {
  const [page, setPage] = useState('Dashboard')
  const [reports, setReports] = useState([])
  const [officerReports, setOfficerReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)

  // Report form fields
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [wasteType, setWasteType] = useState('')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [detectingGps, setDetectingGps] = useState(false)

  // UI feedback & auth
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Search & Filters
  const [officerSearch, setOfficerSearch] = useState('')
  const [officerStatusFilter, setOfficerStatusFilter] = useState('all')
  const [citizenSearch, setCitizenSearch] = useState('')
  const [citizenStatusFilter, setCitizenStatusFilter] = useState('all')

  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState(readSavedUser)

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const isOfficer = ['officer', 'admin'].includes(
    String(user?.role || '').toLowerCase()
  )

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Report Waste', icon: PlusCircle },
    { name: 'My Reports', icon: ClipboardList },
    { name: 'AI Classifier', icon: Sparkles },
    ...(isOfficer ? [{ name: 'Officer Dashboard', icon: Shield }] : []),
    { name: 'Account', icon: User },
  ]

  const loadReports = useCallback(async () => {
    if (!token) return

    try {
      const data = await apiRequest('/api/my-reports', {}, token)
      setReports((data.reports || []).map(formatReport))
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  const loadOfficerReports = useCallback(async () => {
    if (!token || !['officer', 'admin'].includes(
      String(user?.role || '').toLowerCase()
    )) {
      return
    }

    try {
      const data = await apiRequest('/api/incidents', {}, token)
      setOfficerReports((data.complaints || []).map(formatReport))
    } catch (err) {
      setError(err.message)
    }
  }, [token, user?.role])

  useEffect(() => {
    let active = true

    if (!token) return

    async function initializePortalData() {
      try {
        const data = await apiRequest('/api/my-reports', {}, token)
        if (active) {
          setReports((data.reports || []).map(formatReport))
        }
      } catch (err) {
        if (active) setError(err.message)
      }

      if (['officer', 'admin'].includes(
        String(user?.role || '').toLowerCase()
      )) {
        try {
          const offData = await apiRequest('/api/incidents', {}, token)
          if (active) {
            setOfficerReports((offData.complaints || []).map(formatReport))
          }
        } catch (err) {
          if (active) setError(err.message)
        }
      }
    }

    initializePortalData()

    return () => {
      active = false
    }
  }, [token, user?.role])

  // Handle Photo selection with preview
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null
    setPhoto(file)
    setAnalysis(null)
    setError('')
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setPhotoPreview(previewUrl)
    } else {
      setPhotoPreview(null)
    }
  }

  function navigate(nextPage) {
    if (nextPage === 'Officer Dashboard' && !isOfficer) {
      setError('Administrative or Sanitation Officer access credentials required.')
      return
    }

    setPage(nextPage)
    setMessage('')
    setError('')
    setMobileMenuOpen(false)

    if (nextPage === 'Officer Dashboard') {
      loadOfficerReports()
    }
  }

  function saveSession(accessToken, account) {
    localStorage.setItem('cleanbharat_token', accessToken)
    localStorage.setItem('cleanbharat_user', JSON.stringify(account))

    setToken(accessToken)
    setUser(account)
    setPassword('')
    setMessage('Authentication successful. Welcome to the Municipal Grievance Portal.')
    setError('')
    setPage('Dashboard')
  }

  async function submitAuth(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (authMode === 'register') {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({ email, password, role: 'citizen' }),
        })

        setMessage('Citizen account registered successfully! Please sign in with your credentials.')
        setAuthMode('login')
      } else {
        const data = await apiRequest('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })

        saveSession(data.access_token, {
          email,
          role: data.role || 'citizen',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('cleanbharat_token')
    localStorage.removeItem('cleanbharat_user')

    setToken('')
    setUser(null)
    setReports([])
    setOfficerReports([])
    setSelectedReport(null)
    setMessage('You have signed out of the Municipal Portal.')
    setError('')
    setPage('Dashboard')
  }

  // Detect GPS
  const detectGpsLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation service is not supported by your browser.')
      return
    }
    setDetectingGps(true)
    setError('')
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 60000,
          enableHighAccuracy: true
        })
      })
      const lat = position.coords.latitude.toFixed(6)
      const lng = position.coords.longitude.toFixed(6)
      setLatitude(String(lat))
      setLongitude(String(lng))
      if (!location) {
        setLocation(`GPS: ${lat}, ${lng}`)
      }
      setMessage(`GPS coordinates captured: ${lat}, ${lng}`)
    } catch {
      setError('Unable to fetch precise location. Please enter your street landmark manually.')
    } finally {
      setDetectingGps(false)
    }
  }

  async function submitReport(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!token) {
      setError('Citizen authentication required. Please sign in to submit a grievance.')
      setPage('Account')
      return
    }

    if (!title.trim() || !location.trim()) {
      setError('Please provide the grievance title and location details.')
      return
    }

    setLoading(true)

    try {
      let finalLat = latitude || '0'
      let finalLng = longitude || '0'

      // If coords not detected, try quick fallback
      if (finalLat === '0' && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              maximumAge: 60000,
            })
          })
          finalLat = String(position.coords.latitude)
          finalLng = String(position.coords.longitude)
        } catch {
          // Typed location is preserved
        }
      }

      const fullDescription = [
        `Location: ${location.trim()}`,
        description.trim(),
      ].filter(Boolean).join('\n')

      const finalWasteType = wasteType || analysis?.waste_type || null

      const data = await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: fullDescription,
          latitude: finalLat,
          longitude: finalLng,
          waste_type: finalWasteType,
          photo_url: null,
        }),
      }, token)

      setTitle('')
      setLocation('')
      setDescription('')
      setWasteType('')
      setLatitude('')
      setLongitude('')
      setPhoto(null)
      setPhotoPreview(null)
      setAnalysis(null)

      setMessage(`Grievance registered successfully. Reference ID: ${data.complaint_id}`)

      await loadReports()
      setPage('My Reports')

      if (isOfficer) {
        await loadOfficerReports()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function analyzePhoto() {
    if (!photo) {
      setError('Please select an image file first.')
      return
    }

    setAnalyzing(true)
    setError('')
    setMessage('')
    setAnalysis(null)

    try {
      const formData = new FormData()
      formData.append('file', photo)

      const data = await apiRequest('/api/analyze-image', {
        method: 'POST',
        body: formData,
      })

      setAnalysis(data)
      setMessage(`AI Classification completed: ${data.waste_type?.toUpperCase()} (${(data.confidence * 100).toFixed(1)}% confidence)`)
      if (data.waste_type && !wasteType) {
        // Find matching or set capital
        const match = COMMON_WASTE_CATEGORIES.find(
          c => c.toLowerCase().includes(data.waste_type.toLowerCase())
        )
        if (match) setWasteType(match)
        else setWasteType(data.waste_type.charAt(0).toUpperCase() + data.waste_type.slice(1))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function updateReportStatus(report, nextStatus) {
    if (!isOfficer) {
      setError('Only authorized municipal officers can modify grievance status.')
      return
    }

    const apiStatus = nextStatus.toLowerCase()

    setUpdatingId(report.id)
    setError('')
    setMessage('')

    try {
      await apiRequest(
        `/api/complaints/${encodeURIComponent(report.id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: apiStatus }),
        },
        token
      )

      setMessage(`Complaint Ref ${report.id} updated to status: ${nextStatus.toUpperCase()}.`)

      await loadOfficerReports()
      await loadReports()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingId('')
    }
  }

  // Real backend-derived counts
  const citizenTotal = reports.length
  const citizenOpen = reports.filter(r => r.status === 'Open').length
  const citizenAssigned = reports.filter(r => r.status === 'Assigned').length
  const citizenResolved = reports.filter(r => r.status === 'Resolved').length

  const officerTotal = officerReports.length
  const officerOpen = officerReports.filter(r => r.status === 'Open').length
  const officerAssigned = officerReports.filter(r => r.status === 'Assigned').length
  const officerResolved = officerReports.filter(r => r.status === 'Resolved').length

  // Filtered lists
  const filteredCitizenReports = useMemo(() => {
    return reports.filter(report => {
      const matchesStatus =
        citizenStatusFilter === 'all' ||
        report.status.toLowerCase() === citizenStatusFilter.toLowerCase()
      const q = citizenSearch.toLowerCase().trim()
      const matchesSearch = !q ||
        report.title.toLowerCase().includes(q) ||
        report.id.toLowerCase().includes(q) ||
        report.location.toLowerCase().includes(q) ||
        (report.wasteType && report.wasteType.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [reports, citizenStatusFilter, citizenSearch])

  const filteredOfficerReports = useMemo(() => {
    return officerReports.filter(report => {
      const matchesStatus =
        officerStatusFilter === 'all' ||
        report.status.toLowerCase() === officerStatusFilter.toLowerCase()
      const q = officerSearch.toLowerCase().trim()
      const matchesSearch = !q ||
        report.title.toLowerCase().includes(q) ||
        report.id.toLowerCase().includes(q) ||
        report.location.toLowerCase().includes(q) ||
        (report.wasteType && report.wasteType.toLowerCase().includes(q)) ||
        (report.userId && String(report.userId).includes(q))
      return matchesStatus && matchesSearch
    })
  }, [officerReports, officerStatusFilter, officerSearch])

  return (
    <div className="gov-layout">
      {/* Top Tricolor Accent Bar */}
      <div className="civic-stripe" aria-hidden="true">
        <span className="stripe-saffron" />
        <span className="stripe-white" />
        <span className="stripe-green" />
      </div>

      {/* Top Civic Utility & Header Bar */}
      <header className="gov-utility-header">
        <div className="utility-left">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="civic-emblem-badge">
            <Building2 size={16} className="emblem-icon" />
            <span className="emblem-text">MUNICIPAL SOLID WASTE MANAGEMENT & GRIEVANCE REDRESSAL SYSTEM</span>
          </div>
        </div>
        <div className="utility-right">
          <div className="helpline-badge">
            <PhoneCall size={13} />
            <span>Civic Control Helpline: <strong>1969</strong> (Toll Free)</span>
          </div>
          {user ? (
            <div className="user-profile-badge">
              <span className="user-role-tag">
                {isOfficer ? 'Sanitation Officer' : 'Citizen'}
              </span>
              <span className="user-email-text" title={user.email}>
                {user.email}
              </span>
              <button
                className="gov-logout-btn"
                onClick={logout}
                title="Sign out of portal"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              className="gov-login-link-btn"
              onClick={() => navigate('Account')}
            >
              <User size={14} />
              <span>Citizen Sign In</span>
            </button>
          )}
        </div>
      </header>

      <div className="gov-body-wrapper">
        {/* Sidebar */}
        <aside className={`gov-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand-block">
            <div className="brand-crest">
              <span className="crest-symbol">♻</span>
            </div>
            <div className="brand-text-group">
              <h1 className="brand-title">CleanBharat<span>AI</span></h1>
              <p className="brand-caption">MUNICIPAL SOLID WASTE PORTAL</p>
            </div>
          </div>

          <div className="nav-section-label">PORTAL NAVIGATION</div>

          <nav className="gov-nav-menu">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = page === item.name
              return (
                <button
                  key={item.name}
                  className={`gov-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(item.name)}
                >
                  <Icon size={18} className="nav-icon" />
                  <span className="nav-title">{item.name}</span>
                  {item.name === 'My Reports' && token && (
                    <span className="nav-pill">{reports.length}</span>
                  )}
                  {item.name === 'Officer Dashboard' && token && (
                    <span className="nav-pill officer-pill">{officerReports.length}</span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="sidebar-footer-card">
            <div className="footer-card-header">
              <Shield size={16} className="shield-icon" />
              <span>Citizen Charter SLA</span>
            </div>
            <p className="footer-card-body">
              Standard grievance resolution turnaround is <strong>48–72 hours</strong>. Ensure exact street location is mentioned for field teams.
            </p>
            <div className="footer-card-meta">
              <span className="meta-dot" />
              <span>Grievance Cell · Active</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="gov-main-content">
          {/* Section Breadcrumb & Title Bar */}
          <div className="portal-header-banner">
            <div>
              <div className="portal-breadcrumb">
                <span>E-Governance Portal</span>
                <span className="bc-sep">/</span>
                <span className="bc-current">{page}</span>
              </div>
              <h2 className="portal-main-heading">
                {page === 'Dashboard' && (isOfficer ? 'Municipal Officer Grievance Redressal Workspace' : 'Municipal Waste Management Dashboard')}
                {page === 'Report Waste' && 'Lodge Civic Waste Grievance'}
                {page === 'My Reports' && 'My Grievance Redressal Records'}
                {page === 'AI Classifier' && 'AI Waste Image Classification Tool'}
                {page === 'Officer Dashboard' && 'Municipal Officer Grievance Redressal Workspace'}
                {page === 'Account' && (user ? 'Citizen Account Profile' : 'Citizen Portal Authentication')}
              </h2>
              <p className="portal-sub-heading">
                {page === 'Dashboard' && 'Monitor waste complaints, report civic sanitation issues, and track resolution progress.'}
                {page === 'Report Waste' && 'Submit solid-waste grievances directly to the municipal sanitation control room.'}
                {page === 'My Reports' && 'Review the current status and resolution history of all your submitted complaints.'}
                {page === 'AI Classifier' && 'Upload solid-waste photos to identify material categories and municipal recycling methods.'}
                {page === 'Officer Dashboard' && 'Review public solid-waste complaints and update departmental field status.'}
                {page === 'Account' && 'Manage your grievance portal credentials and access privileges.'}
              </p>
            </div>

            {page === 'Dashboard' && (
              <div className="header-action-group">
                <button
                  className="gov-btn gov-btn-primary"
                  onClick={() => navigate('Report Waste')}
                >
                  <PlusCircle size={16} />
                  <span>+ Report Waste</span>
                </button>
              </div>
            )}
          </div>

          {/* Feedback Notices */}
          {message && (
            <div className="gov-alert gov-alert-success" role="status">
              <CheckCircle2 size={18} className="alert-icon" />
              <div className="alert-content">{message}</div>
              <button
                className="alert-close-btn"
                onClick={() => setMessage('')}
                aria-label="Dismiss message"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {error && (
            <div className="gov-alert gov-alert-error" role="alert">
              <AlertTriangle size={18} className="alert-icon" />
              <div className="alert-content">{error}</div>
              <button
                className="alert-close-btn"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* DASHBOARD PAGE */}
          {/* ============================================================ */}
          {page === 'Dashboard' && (
            <div className="portal-dashboard-view">
              {/* Summary Statistics Cards (4 Cards from real data) */}
              <section className="stats-row" aria-label="Grievance Statistics">
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">
                      {isOfficer ? 'Total Ward Complaints' : 'My Total Reports'}
                    </span>
                    <span className="stat-icon-wrapper icon-total">
                      <ClipboardList size={18} />
                    </span>
                  </div>
                  <div className="stat-number">
                    {isOfficer ? officerTotal : citizenTotal}
                  </div>
                  <div className="stat-footer-text">
                    {isOfficer ? 'All registered complaints in database' : 'Submitted under current account'}
                  </div>
                </div>

                <div className="stat-card stat-open">
                  <div className="stat-card-top">
                    <span className="stat-label">
                      {isOfficer ? 'Open / Pending Review' : 'My Open Reports'}
                    </span>
                    <span className="stat-icon-wrapper icon-open">
                      <AlertCircle size={18} />
                    </span>
                  </div>
                  <div className="stat-number">
                    {isOfficer ? officerOpen : citizenOpen}
                  </div>
                  <div className="stat-footer-text">
                    Awaiting municipal field assignment
                  </div>
                </div>

                <div className="stat-card stat-assigned">
                  <div className="stat-card-top">
                    <span className="stat-label">
                      {isOfficer ? 'Assigned / In Progress' : 'Assigned for Action'}
                    </span>
                    <span className="stat-icon-wrapper icon-assigned">
                      <Clock size={18} />
                    </span>
                  </div>
                  <div className="stat-number">
                    {isOfficer ? officerAssigned : citizenAssigned}
                  </div>
                  <div className="stat-footer-text">
                    Field sanitation teams assigned
                  </div>
                </div>

                <div className="stat-card stat-resolved">
                  <div className="stat-card-top">
                    <span className="stat-label">
                      {isOfficer ? 'Resolved Complaints' : 'Resolved Reports'}
                    </span>
                    <span className="stat-icon-wrapper icon-resolved">
                      <CheckCircle2 size={18} />
                    </span>
                  </div>
                  <div className="stat-number">
                    {isOfficer ? officerResolved : citizenResolved}
                  </div>
                  <div className="stat-footer-text">
                    Sanitation redressal verified
                  </div>
                </div>
              </section>

              {/* Citizen Action Bar & Recent Grievances */}
              <section className="dashboard-content-grid">
                <div className="grid-main-col">
                  <div className="gov-card">
                    <div className="card-header-bar">
                      <div>
                        <h3 className="card-title">Recent Waste Grievances</h3>
                        <p className="card-subtitle">
                          {isOfficer
                            ? 'Latest complaints logged across municipal wards.'
                            : 'Grievances registered through your citizen account.'}
                        </p>
                      </div>
                      <div className="card-actions">
                        <button
                          className="gov-btn gov-btn-outline gov-btn-sm"
                          onClick={() => navigate(isOfficer ? 'Officer Dashboard' : 'My Reports')}
                        >
                          <span>View Complete List</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {!token ? (
                      <div className="gov-empty-box">
                        <User size={36} className="empty-icon" />
                        <h4 className="empty-title">Citizen Authentication Required</h4>
                        <p className="empty-desc">
                          Please sign in with your registered email to view and track your submitted waste complaints.
                        </p>
                        <button
                          className="gov-btn gov-btn-primary gov-btn-sm"
                          onClick={() => navigate('Account')}
                        >
                          Sign In / Register
                        </button>
                      </div>
                    ) : (isOfficer ? officerReports : reports).length === 0 ? (
                      <div className="gov-empty-box">
                        <ClipboardList size={36} className="empty-icon" />
                        <h4 className="empty-title">No Grievances Recorded</h4>
                        <p className="empty-desc">
                          There are currently no solid-waste complaints recorded under this account.
                        </p>
                        <button
                          className="gov-btn gov-btn-primary gov-btn-sm"
                          onClick={() => navigate('Report Waste')}
                        >
                          + Lodge First Grievance
                        </button>
                      </div>
                    ) : (
                      <div className="gov-table-responsive">
                        <table className="gov-table">
                          <thead>
                            <tr>
                              <th>Complaint ID</th>
                              <th>Issue Summary</th>
                              <th>Waste Category</th>
                              <th>Location / Landmark</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(isOfficer ? officerReports : reports).slice(0, 5).map((rep) => (
                              <tr key={rep.id}>
                                <td className="font-mono text-bold">{rep.id}</td>
                                <td>
                                  <div className="table-title">{rep.title}</div>
                                  {rep.description && (
                                    <div className="table-desc-snip">{rep.description}</div>
                                  )}
                                </td>
                                <td>
                                  {rep.wasteType ? (
                                    <span className="gov-pill-badge pill-neutral">
                                      {rep.wasteType}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td>
                                  <div className="table-location">
                                    <MapPin size={12} className="inline-icon" />
                                    <span>{rep.location}</span>
                                  </div>
                                </td>
                                <td>
                                  <StatusBadge status={rep.status} />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="gov-btn gov-btn-ghost gov-btn-xs"
                                    onClick={() => setSelectedReport(rep)}
                                  >
                                    <Eye size={13} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Quick Tools Column */}
                <div className="grid-side-col">
                  {/* Quick Action Card */}
                  <div className="gov-card quick-action-card">
                    <div className="quick-action-header">
                      <div className="action-icon-box">
                        <PlusCircle size={20} />
                      </div>
                      <div>
                        <h4 className="quick-title">Need to Report Waste?</h4>
                        <p className="quick-sub">Municipal Grievance Lodgement</p>
                      </div>
                    </div>
                    <p className="quick-text">
                      Spot overflowing dustbins, roadside garbage heaps, or plastic dump sites? Submit a geotagged complaint for immediate field inspection.
                    </p>
                    <button
                      className="gov-btn gov-btn-primary gov-btn-block"
                      onClick={() => navigate('Report Waste')}
                    >
                      <span>Lodge Grievance Now</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* AI Quick Feature Card */}
                  <div className="gov-card ai-feature-card">
                    <div className="quick-action-header">
                      <div className="action-icon-box ai-icon-box">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="quick-title">AI Waste Classifier</h4>
                        <p className="quick-sub">Material Identification Assist</p>
                      </div>
                    </div>
                    <p className="quick-text">
                      Upload photos of waste objects to automatically identify recyclable categories (plastic, glass, paper, cardboard, metal).
                    </p>
                    <button
                      className="gov-btn gov-btn-outline gov-btn-block"
                      onClick={() => navigate('AI Classifier')}
                    >
                      <Camera size={14} />
                      <span>Launch AI Classifier</span>
                    </button>
                  </div>

                  {/* Grievance Protocol Guidelines */}
                  <div className="gov-card guidelines-card">
                    <h4 className="guidelines-title">
                      <Info size={15} />
                      <span>Citizen Grievance Protocol</span>
                    </h4>
                    <ul className="guidelines-list">
                      <li>Ensure proper landmark or GPS location is attached.</li>
                      <li>Separate dry recyclable waste from wet compostable waste.</li>
                      <li>Complaints receive a unique Reference ID for tracking.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ============================================================ */}
          {/* REPORT WASTE PAGE */}
          {/* ============================================================ */}
          {page === 'Report Waste' && (
            <div className="portal-form-view">
              <div className="gov-card form-layout-card">
                <div className="form-portal-header">
                  <div className="form-badge-icon">
                    <PlusCircle size={24} />
                  </div>
                  <div>
                    <h3 className="form-card-title">Citizen Grievance Lodgement Form</h3>
                    <p className="form-card-subtitle">
                      Solid Waste Management & Sanitation Redressal Wing
                    </p>
                  </div>
                </div>

                {!token && (
                  <div className="gov-alert gov-alert-warning">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Authentication Required:</strong> Please{' '}
                      <button
                        className="text-link"
                        onClick={() => navigate('Account')}
                      >
                        sign in to your citizen account
                      </button>{' '}
                      prior to submitting a grievance so your report can be tracked and resolved.
                    </div>
                  </div>
                )}

                <div className="form-grid-columns">
                  {/* Left Form Column */}
                  <form onSubmit={submitReport} className="report-main-form">
                    <div className="gov-form-group">
                      <label htmlFor="issue-title" className="gov-label">
                        Grievance Summary / Title <span className="req-star">*</span>
                      </label>
                      <input
                        id="issue-title"
                        type="text"
                        className="gov-input"
                        placeholder="e.g. Uncollected garbage dump near Ward 12 bus stop"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                      <span className="gov-hint">State the nature of the solid-waste issue clearly.</span>
                    </div>

                    <div className="gov-form-group">
                      <label htmlFor="waste-category" className="gov-label">
                        Waste Material Category
                      </label>
                      <select
                        id="waste-category"
                        className="gov-select"
                        value={wasteType}
                        onChange={(e) => setWasteType(e.target.value)}
                      >
                        <option value="">— Select Waste Category (Optional) —</option>
                        {COMMON_WASTE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <span className="gov-hint">
                        Choose the primary material type, or use the AI image tool below to suggest one.
                      </span>
                    </div>

                    <div className="gov-form-group">
                      <div className="label-with-action">
                        <label htmlFor="issue-location" className="gov-label">
                          Location or Landmark <span className="req-star">*</span>
                        </label>
                        <button
                          type="button"
                          className="gov-btn gov-btn-ghost gov-btn-xs"
                          onClick={detectGpsLocation}
                          disabled={detectingGps}
                        >
                          <MapPin size={12} />
                          <span>{detectingGps ? 'Detecting GPS...' : 'Detect GPS Coordinates'}</span>
                        </button>
                      </div>
                      <input
                        id="issue-location"
                        type="text"
                        className="gov-input"
                        placeholder="e.g. MG Road, Near Central Community Hall, Ward 4"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                      />
                      {(latitude || longitude) && (
                        <div className="gps-pill">
                          <Check size={12} />
                          <span>Coordinates: {latitude}, {longitude}</span>
                        </div>
                      )}
                    </div>

                    <div className="gov-form-group">
                      <label htmlFor="issue-desc" className="gov-label">
                        Detailed Description (Optional)
                      </label>
                      <textarea
                        id="issue-desc"
                        rows={3}
                        className="gov-textarea"
                        placeholder="Add additional details such as overflow duration, obstruction to traffic, or health hazards..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>

                    <div className="form-submit-row">
                      <button
                        type="button"
                        className="gov-btn gov-btn-outline"
                        onClick={() => navigate('Dashboard')}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gov-btn gov-btn-primary"
                        disabled={loading || !token}
                      >
                        {loading ? 'Registering Grievance...' : 'Submit Grievance Lodgement'}
                      </button>
                    </div>
                  </form>

                  {/* Right Image & AI Classifier Box */}
                  <div className="report-ai-sidebox">
                    <div className="ai-box-inner">
                      <div className="ai-box-heading">
                        <Camera size={18} className="ai-cam-icon" />
                        <div>
                          <h4 className="ai-box-title">Upload Photo & AI Analysis</h4>
                          <p className="ai-box-sub">JPG, PNG, or WEBP (Max 5 MB)</p>
                        </div>
                      </div>

                      <div className="file-upload-dropzone">
                        <input
                          id="waste-photo-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="file-hidden-input"
                        />
                        <label htmlFor="waste-photo-input" className="file-dropzone-label">
                          <Upload size={24} className="upload-arrow" />
                          <span className="dropzone-text">
                            {photo ? photo.name : 'Click to select waste image'}
                          </span>
                          <span className="dropzone-sub">
                            Supports photo verification & AI material sorting
                          </span>
                        </label>
                      </div>

                      {photoPreview && (
                        <div className="preview-container">
                          <img src={photoPreview} alt="Selected waste preview" className="photo-thumb" />
                          <div className="preview-meta">
                            <span className="file-size-tag">
                              {(photo.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                            <button
                              type="button"
                              className="gov-btn gov-btn-primary gov-btn-xs"
                              onClick={analyzePhoto}
                              disabled={analyzing}
                            >
                              <Sparkles size={12} />
                              <span>{analyzing ? 'Analyzing Image...' : 'Analyze with AI'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* AI Result Card */}
                      {analysis && (
                        <div className="ai-result-display">
                          <div className="ai-result-top">
                            <Sparkles size={16} className="sparkle-active" />
                            <span className="ai-badge-label">AI Classification Result</span>
                          </div>
                          <div className="ai-result-body">
                            <div className="ai-metric-row">
                              <span className="metric-label">Detected Material:</span>
                              <strong className="metric-value capitalize">{analysis.waste_type}</strong>
                            </div>
                            <div className="ai-metric-row">
                              <span className="metric-label">Prediction Confidence:</span>
                              <span className="metric-score">
                                {(analysis.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="ai-action-box">
                              <span className="action-title">Recommended Civic Action:</span>
                              <p className="action-desc">{analysis.suggested_action}</p>
                            </div>
                            <p className="ai-disclaimer">
                              {analysis.note}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="ai-info-guidance">
                        <Info size={13} />
                        <span>
                          AI image classification identifies individual waste types for sorting. Roadside pile density requires on-site sanitation officer inspection.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MY REPORTS / ALL REPORTS PAGE */}
          {/* ============================================================ */}
          {page === 'My Reports' && (
            <div className="portal-reports-view">
              <div className="gov-card">
                <div className="card-header-bar">
                  <div>
                    <h3 className="card-title">My Registered Grievances</h3>
                    <p className="card-subtitle">
                      List of solid-waste grievances submitted under your citizen account.
                    </p>
                  </div>
                  <button
                    className="gov-btn gov-btn-primary gov-btn-sm"
                    onClick={() => navigate('Report Waste')}
                  >
                    <PlusCircle size={14} />
                    <span>+ Lodge New Grievance</span>
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="table-filter-bar">
                  <div className="search-input-box">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="gov-input search-input"
                      placeholder="Search complaints by ID, title, or location..."
                      value={citizenSearch}
                      onChange={(e) => setCitizenSearch(e.target.value)}
                    />
                    {citizenSearch && (
                      <button
                        className="clear-search-btn"
                        onClick={() => setCitizenSearch('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="filter-pill-group">
                    <button
                      className={`filter-pill ${citizenStatusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setCitizenStatusFilter('all')}
                    >
                      All ({reports.length})
                    </button>
                    <button
                      className={`filter-pill ${citizenStatusFilter === 'open' ? 'active' : ''}`}
                      onClick={() => setCitizenStatusFilter('open')}
                    >
                      Open ({citizenOpen})
                    </button>
                    <button
                      className={`filter-pill ${citizenStatusFilter === 'assigned' ? 'active' : ''}`}
                      onClick={() => setCitizenStatusFilter('assigned')}
                    >
                      Assigned ({citizenAssigned})
                    </button>
                    <button
                      className={`filter-pill ${citizenStatusFilter === 'resolved' ? 'active' : ''}`}
                      onClick={() => setCitizenStatusFilter('resolved')}
                    >
                      Resolved ({citizenResolved})
                    </button>
                  </div>
                </div>

                {!token ? (
                  <div className="gov-empty-box">
                    <User size={36} className="empty-icon" />
                    <h4 className="empty-title">Sign in to Access Your Grievances</h4>
                    <p className="empty-desc">
                      Grievances are linked to your verified citizen account.
                    </p>
                    <button
                      className="gov-btn gov-btn-primary gov-btn-sm"
                      onClick={() => navigate('Account')}
                    >
                      Sign In
                    </button>
                  </div>
                ) : filteredCitizenReports.length === 0 ? (
                  <div className="gov-empty-box">
                    <ClipboardList size={36} className="empty-icon" />
                    <h4 className="empty-title">No Grievances Found</h4>
                    <p className="empty-desc">
                      {citizenSearch || citizenStatusFilter !== 'all'
                        ? 'No complaints matched your current filter criteria.'
                        : 'You have not registered any grievances yet.'}
                    </p>
                    {citizenSearch || citizenStatusFilter !== 'all' ? (
                      <button
                        className="gov-btn gov-btn-outline gov-btn-sm"
                        onClick={() => {
                          setCitizenSearch('')
                          setCitizenStatusFilter('all')
                        }}
                      >
                        Reset Filters
                      </button>
                    ) : (
                      <button
                        className="gov-btn gov-btn-primary gov-btn-sm"
                        onClick={() => navigate('Report Waste')}
                      >
                        Lodge a Grievance
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="gov-table-responsive">
                    <table className="gov-table">
                      <thead>
                        <tr>
                          <th>Complaint ID</th>
                          <th>Issue Title & Details</th>
                          <th>Waste Category</th>
                          <th>Location / Coordinates</th>
                          <th>Date Lodged</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCitizenReports.map((report) => (
                          <tr key={report.id}>
                            <td className="font-mono text-bold">{report.id}</td>
                            <td>
                              <div className="table-title">{report.title}</div>
                              {report.description && (
                                <div className="table-desc-snip">{report.description}</div>
                              )}
                            </td>
                            <td>
                              {report.wasteType ? (
                                <span className="gov-pill-badge pill-neutral">
                                  {report.wasteType}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>
                              <div className="table-location">
                                <MapPin size={12} className="inline-icon" />
                                <span>{report.location}</span>
                              </div>
                            </td>
                            <td className="text-muted">{report.date}</td>
                            <td>
                              <StatusBadge status={report.status} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="gov-btn gov-btn-ghost gov-btn-xs"
                                onClick={() => setSelectedReport(report)}
                              >
                                <Eye size={13} />
                                <span>View File</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* AI CLASSIFIER DEDICATED TOOL PAGE */}
          {/* ============================================================ */}
          {page === 'AI Classifier' && (
            <div className="portal-ai-standalone-view">
              <div className="gov-card">
                <div className="card-header-bar">
                  <div className="tool-title-group">
                    <div className="tool-icon-badge">
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <h3 className="card-title">AI Solid Waste Classification Tool</h3>
                      <p className="card-subtitle">
                        Deep-learning image model for solid-waste category identification and segregation guidance
                      </p>
                    </div>
                  </div>
                </div>

                <div className="ai-standalone-grid">
                  <div className="ai-tool-left">
                    <div className="gov-form-group">
                      <label className="gov-label">Upload Solid-Waste Photo</label>
                      <div className="file-upload-dropzone dropzone-large">
                        <input
                          id="standalone-ai-file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="file-hidden-input"
                        />
                        <label htmlFor="standalone-ai-file" className="file-dropzone-label">
                          <Upload size={32} className="upload-arrow" />
                          <span className="dropzone-text">
                            {photo ? photo.name : 'Select or drop an image file (JPG, PNG, WEBP)'}
                          </span>
                          <span className="dropzone-sub">
                            Maximum size 5 MB · High clarity ensures optimal AI classification
                          </span>
                        </label>
                      </div>
                    </div>

                    {photoPreview && (
                      <div className="preview-container preview-large">
                        <img src={photoPreview} alt="Target waste item" className="photo-thumb-large" />
                        <div className="preview-meta">
                          <span>File: {photo.name}</span>
                          <button
                            type="button"
                            className="gov-btn gov-btn-primary"
                            onClick={analyzePhoto}
                            disabled={analyzing}
                          >
                            <Sparkles size={14} />
                            <span>{analyzing ? 'Analyzing with Model...' : 'Run Waste Classification'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ai-tool-right">
                    {analysis ? (
                      <div className="standalone-ai-card">
                        <div className="card-badge-header">
                          <Sparkles size={16} />
                          <span>Classification Findings</span>
                        </div>
                        <h4 className="classified-category capitalize">{analysis.waste_type}</h4>
                        <div className="confidence-meter">
                          <div className="meter-label-row">
                            <span>Confidence Level</span>
                            <strong>{(analysis.confidence * 100).toFixed(1)}%</strong>
                          </div>
                          <div className="meter-track">
                            <div
                              className="meter-bar"
                              style={{ width: `${Math.min(100, analysis.confidence * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="handling-guide-card">
                          <h5 className="guide-title">Municipal Handling & Recycling Recommendation</h5>
                          <p className="guide-text">{analysis.suggested_action}</p>
                        </div>

                        <div className="model-note-box">
                          <Info size={14} />
                          <span>{analysis.note}</span>
                        </div>

                        <button
                          className="gov-btn gov-btn-primary gov-btn-block"
                          onClick={() => {
                            setWasteType(analysis.waste_type.charAt(0).toUpperCase() + analysis.waste_type.slice(1))
                            navigate('Report Waste')
                          }}
                        >
                          <span>Lodge Grievance for this Waste Category</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="ai-placeholder-box">
                        <Camera size={40} className="placeholder-icon" />
                        <h4 className="placeholder-title">Awaiting Image Submission</h4>
                        <p className="placeholder-desc">
                          Upload an image of a waste item on the left panel and click &ldquo;Run Waste Classification&rdquo; to analyze material type and municipal handling guidance.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* OFFICER DASHBOARD (ADMINISTRATIVE WORKSPACE) */}
          {/* ============================================================ */}
          {page === 'Officer Dashboard' && isOfficer && (
            <div className="portal-officer-view">
              {/* Officer Stats Row */}
              <section className="stats-row">
                <div className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">Total Ward Complaints</span>
                    <span className="stat-icon-wrapper icon-total">
                      <ClipboardList size={18} />
                    </span>
                  </div>
                  <div className="stat-number">{officerTotal}</div>
                  <div className="stat-footer-text">Total complaints on municipal record</div>
                </div>

                <div className="stat-card stat-open">
                  <div className="stat-card-top">
                    <span className="stat-label">Unassigned / Open</span>
                    <span className="stat-icon-wrapper icon-open">
                      <AlertCircle size={18} />
                    </span>
                  </div>
                  <div className="stat-number">{officerOpen}</div>
                  <div className="stat-footer-text">Action pending sanitation deployment</div>
                </div>

                <div className="stat-card stat-assigned">
                  <div className="stat-card-top">
                    <span className="stat-label">Under Field Action</span>
                    <span className="stat-icon-wrapper icon-assigned">
                      <Clock size={18} />
                    </span>
                  </div>
                  <div className="stat-number">{officerAssigned}</div>
                  <div className="stat-footer-text">Assigned to field sanitation teams</div>
                </div>

                <div className="stat-card stat-resolved">
                  <div className="stat-card-top">
                    <span className="stat-label">Successfully Resolved</span>
                    <span className="stat-icon-wrapper icon-resolved">
                      <CheckCircle2 size={18} />
                    </span>
                  </div>
                  <div className="stat-number">{officerResolved}</div>
                  <div className="stat-footer-text">Cleaned & redressal recorded</div>
                </div>
              </section>

              {/* Administrative Table */}
              <div className="gov-card">
                <div className="card-header-bar">
                  <div>
                    <h3 className="card-title">Municipal Grievance Redressal Registry</h3>
                    <p className="card-subtitle">
                      Administrative control workspace for sanitation officers and ward managers
                    </p>
                  </div>
                  <button
                    className="gov-btn gov-btn-outline gov-btn-sm"
                    onClick={loadOfficerReports}
                    disabled={loading}
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    <span>Refresh Records</span>
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="table-filter-bar">
                  <div className="search-input-box">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="gov-input search-input"
                      placeholder="Search by Complaint ID, title, location, category, or Citizen ID..."
                      value={officerSearch}
                      onChange={(e) => setOfficerSearch(e.target.value)}
                    />
                    {officerSearch && (
                      <button
                        className="clear-search-btn"
                        onClick={() => setOfficerSearch('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="filter-pill-group">
                    <button
                      className={`filter-pill ${officerStatusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setOfficerStatusFilter('all')}
                    >
                      All ({officerReports.length})
                    </button>
                    <button
                      className={`filter-pill ${officerStatusFilter === 'open' ? 'active' : ''}`}
                      onClick={() => setOfficerStatusFilter('open')}
                    >
                      Open ({officerOpen})
                    </button>
                    <button
                      className={`filter-pill ${officerStatusFilter === 'assigned' ? 'active' : ''}`}
                      onClick={() => setOfficerStatusFilter('assigned')}
                    >
                      Assigned ({officerAssigned})
                    </button>
                    <button
                      className={`filter-pill ${officerStatusFilter === 'resolved' ? 'active' : ''}`}
                      onClick={() => setOfficerStatusFilter('resolved')}
                    >
                      Resolved ({officerResolved})
                    </button>
                  </div>
                </div>

                {filteredOfficerReports.length === 0 ? (
                  <div className="gov-empty-box">
                    <ClipboardList size={36} className="empty-icon" />
                    <h4 className="empty-title">No Grievances Found</h4>
                    <p className="empty-desc">
                      {officerSearch || officerStatusFilter !== 'all'
                        ? 'No complaints matched the search or filter query.'
                        : 'No grievances have been logged in the municipal database.'}
                    </p>
                  </div>
                ) : (
                  <div className="gov-table-responsive">
                    <table className="gov-table officer-table">
                      <thead>
                        <tr>
                          <th>Complaint ID</th>
                          <th>Grievance Summary</th>
                          <th>Category</th>
                          <th>Location / Coordinates</th>
                          <th>Citizen ID</th>
                          <th>Current Status</th>
                          <th>Update Field Status</th>
                          <th style={{ textAlign: 'right' }}>File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOfficerReports.map((report) => (
                          <tr key={report.id}>
                            <td className="font-mono text-bold">{report.id}</td>
                            <td>
                              <div className="table-title">{report.title}</div>
                              {report.description && (
                                <div className="table-desc-snip">{report.description}</div>
                              )}
                            </td>
                            <td>
                              {report.wasteType ? (
                                <span className="gov-pill-badge pill-neutral">
                                  {report.wasteType}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>
                              <div className="table-location">
                                <MapPin size={12} className="inline-icon" />
                                <span>{report.location}</span>
                              </div>
                            </td>
                            <td className="font-mono text-muted">UID-{report.userId}</td>
                            <td>
                              <StatusBadge status={report.status} />
                            </td>
                            <td>
                              <div className="status-select-wrapper">
                                <select
                                  id={`status-${report.id}`}
                                  className="gov-select gov-select-sm"
                                  value={report.status.toLowerCase()}
                                  disabled={updatingId === report.id}
                                  onChange={(e) => updateReportStatus(report, e.target.value)}
                                >
                                  <option value="open">Open (Unassigned)</option>
                                  <option value="assigned">Assigned (Field Unit)</option>
                                  <option value="resolved">Resolved (Completed)</option>
                                </select>
                                {updatingId === report.id && (
                                  <span className="updating-spinner" title="Saving status...">↻</span>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="gov-btn gov-btn-ghost gov-btn-xs"
                                onClick={() => setSelectedReport(report)}
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ACCOUNT & AUTHENTICATION PAGE */}
          {/* ============================================================ */}
          {page === 'Account' && (
            <div className="portal-account-view">
              <div className="gov-card account-card">
                {user ? (
                  <div className="account-profile-view">
                    <div className="profile-header-strip">
                      <div className="profile-avatar-circle">
                        {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h3 className="profile-email-title">{user.email}</h3>
                        <div className="profile-role-pill">
                          <Shield size={12} />
                          <span>{isOfficer ? 'Authorized Sanitation Officer' : 'Verified Citizen Account'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-details-grid">
                      <div className="detail-item">
                        <span className="detail-label">Authentication Status</span>
                        <strong className="detail-val text-success">Verified Active Session</strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Role Category</span>
                        <strong className="detail-val capitalize">{user.role}</strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Grievances Lodged</span>
                        <strong className="detail-val">{reports.length} Records</strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Resolved Redressals</span>
                        <strong className="detail-val text-success">{citizenResolved} Completed</strong>
                      </div>
                    </div>

                    {isOfficer && (
                      <div className="officer-privilege-note">
                        <Shield size={16} />
                        <div>
                          <strong>Administrative Role Assigned:</strong> You have elevated privileges to update complaint statuses in the Officer Dashboard.
                        </div>
                      </div>
                    )}

                    <div className="profile-actions-row">
                      <button
                        className="gov-btn gov-btn-outline"
                        onClick={() => navigate('Dashboard')}
                      >
                        Return to Dashboard
                      </button>
                      <button
                        className="gov-btn gov-btn-danger"
                        onClick={logout}
                      >
                        <LogOut size={14} />
                        <span>Sign Out of Account</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-auth-view">
                    <div className="auth-header-strip">
                      <div className="auth-icon-box">
                        <User size={24} />
                      </div>
                      <div>
                        <h3 className="auth-title">
                          {authMode === 'login' ? 'Citizen Portal Sign In' : 'Register New Citizen Account'}
                        </h3>
                        <p className="auth-sub">
                          Access municipal grievance lodgement and resolution tracking
                        </p>
                      </div>
                    </div>

                    <div className="auth-tab-switch">
                      <button
                        type="button"
                        className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                        onClick={() => {
                          setAuthMode('login')
                          setMessage('')
                          setError('')
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                        onClick={() => {
                          setAuthMode('register')
                          setMessage('')
                          setError('')
                        }}
                      >
                        Register Account
                      </button>
                    </div>

                    <form onSubmit={submitAuth} className="auth-form">
                      <div className="gov-form-group">
                        <label htmlFor="auth-email" className="gov-label">
                          Email Address <span className="req-star">*</span>
                        </label>
                        <input
                          id="auth-email"
                          type="email"
                          autoComplete="email"
                          className="gov-input"
                          placeholder="citizen@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="gov-form-group">
                        <label htmlFor="auth-password" className="gov-label">
                          Password (Minimum 8 Characters) <span className="req-star">*</span>
                        </label>
                        <input
                          id="auth-password"
                          type="password"
                          autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                          minLength={8}
                          className="gov-input"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="gov-btn gov-btn-primary gov-btn-block"
                        disabled={loading}
                      >
                        {loading
                          ? 'Verifying...'
                          : authMode === 'login'
                          ? 'Sign In to Portal'
                          : 'Create Citizen Account'}
                      </button>
                    </form>

                    <div className="auth-gov-disclaimer">
                      <Info size={14} />
                      <span>
                        Public self-registration creates standard Citizen accounts. Municipal Sanitation Officer accounts are provisioned administratively by the Municipal Corporation IT Wing.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* COMPLAINT DETAILS MODAL */}
          {/* ============================================================ */}
          {selectedReport && (
            <div className="gov-modal-backdrop" onClick={() => setSelectedReport(null)}>
              <div
                className="gov-modal-dialog"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="modal-header">
                  <div className="modal-header-info">
                    <span className="modal-ref-tag">{selectedReport.id}</span>
                    <h3 className="modal-title">{selectedReport.title}</h3>
                  </div>
                  <button
                    className="modal-close-btn"
                    onClick={() => setSelectedReport(null)}
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-status-banner">
                    <div className="banner-status-left">
                      <span className="banner-label">Current Redressal Status</span>
                      <StatusBadge status={selectedReport.status} />
                    </div>
                    <div className="banner-date">
                      <Calendar size={13} />
                      <span>Lodged on: {selectedReport.date}</span>
                    </div>
                  </div>

                  {/* Resolution Stepper Tracker */}
                  <div className="resolution-stepper">
                    <div className="step-item step-completed">
                      <div className="step-dot"><Check size={12} /></div>
                      <div className="step-label">Complaint Registered</div>
                    </div>
                    <div className={`step-connector ${selectedReport.status !== 'Open' ? 'connector-active' : ''}`} />
                    <div className={`step-item ${selectedReport.status === 'Assigned' || selectedReport.status === 'Resolved' ? 'step-completed' : 'step-pending'}`}>
                      <div className="step-dot">
                        {selectedReport.status === 'Resolved' ? <Check size={12} /> : <Clock size={12} />}
                      </div>
                      <div className="step-label">Field Unit Assigned</div>
                    </div>
                    <div className={`step-connector ${selectedReport.status === 'Resolved' ? 'connector-active' : ''}`} />
                    <div className={`step-item ${selectedReport.status === 'Resolved' ? 'step-completed' : 'step-pending'}`}>
                      <div className="step-dot">
                        {selectedReport.status === 'Resolved' ? <Check size={12} /> : <CheckCircle2 size={12} />}
                      </div>
                      <div className="step-label">Redressal Verified</div>
                    </div>
                  </div>

                  <div className="modal-details-grid">
                    <div className="modal-field-block">
                      <span className="field-lbl">Location / Street Landmark</span>
                      <div className="field-val location-val">
                        <MapPin size={14} className="val-icon" />
                        <span>{selectedReport.location}</span>
                      </div>
                    </div>

                    <div className="modal-field-block">
                      <span className="field-lbl">Waste Category</span>
                      <div className="field-val">
                        {selectedReport.wasteType ? (
                          <span className="gov-pill-badge pill-neutral">{selectedReport.wasteType}</span>
                        ) : (
                          <span className="text-muted">Unclassified Solid Waste</span>
                        )}
                      </div>
                    </div>

                    {selectedReport.description && (
                      <div className="modal-field-block full-width">
                        <span className="field-lbl">Citizen Grievance Description</span>
                        <div className="field-val desc-val">{selectedReport.description}</div>
                      </div>
                    )}

                    {selectedReport.userId && (
                      <div className="modal-field-block">
                        <span className="field-lbl">Citizen Account ID</span>
                        <div className="field-val font-mono">UID-{selectedReport.userId}</div>
                      </div>
                    )}

                    <div className="modal-field-block">
                      <span className="field-lbl">Department Wing</span>
                      <div className="field-val">Solid Waste Management Cell (SWM)</div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="gov-btn gov-btn-outline"
                    onClick={() => setSelectedReport(null)}
                  >
                    Close Record
                  </button>
                  {isOfficer && (
                    <div className="modal-officer-actions">
                      <span className="officer-quick-label">Quick Update:</span>
                      {selectedReport.status !== 'Assigned' && (
                        <button
                          className="gov-btn gov-btn-outline gov-btn-sm"
                          onClick={() => {
                            updateReportStatus(selectedReport, 'assigned')
                            setSelectedReport({ ...selectedReport, status: 'Assigned' })
                          }}
                        >
                          Mark Assigned
                        </button>
                      )}
                      {selectedReport.status !== 'Resolved' && (
                        <button
                          className="gov-btn gov-btn-primary gov-btn-sm"
                          onClick={() => {
                            updateReportStatus(selectedReport, 'resolved')
                            setSelectedReport({ ...selectedReport, status: 'Resolved' })
                          }}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Portal Official Footer */}
          <footer className="gov-portal-footer">
            <div className="footer-col-brand">
              <strong>CleanBharat AI</strong>
              <span>Municipal Solid Waste Management & Citizen Grievance Redressal Portal</span>
            </div>
            <div className="footer-col-links">
              <span>National Cleanliness Mission Standards</span>
              <span>·</span>
              <span>Citizen Grievance Charter SLA: 48h</span>
              <span>·</span>
              <span>Central Control Helpline: 1969</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const norm = String(status || 'open').toLowerCase()

  if (norm === 'resolved') {
    return (
      <span className="gov-status-badge status-resolved">
        <CheckCircle2 size={12} />
        <span>Resolved</span>
      </span>
    )
  }

  if (norm === 'assigned') {
    return (
      <span className="gov-status-badge status-assigned">
        <Clock size={12} />
        <span>Assigned</span>
      </span>
    )
  }

  return (
    <span className="gov-status-badge status-open">
      <AlertCircle size={12} />
      <span>Open</span>
    </span>
  )
}

export default App
