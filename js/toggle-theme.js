/* global KEEP, SiteTheme */

KEEP.initModeToggle = () => {
  const button = document.querySelector('.tool-toggle-theme-mode')
  const icon = button && button.querySelector('i')
  KEEP.themeUnsubscribe && KEEP.themeUnsubscribe()
  KEEP.utils.modeToggle = {
    enableLightMode: () => SiteTheme.setMode('light'),
    enableDarkMode: () => SiteTheme.setMode('dark')
  }
  KEEP.themeUnsubscribe = SiteTheme.subscribe(mode => {
    const isDark = mode === 'dark'
    KEEP.themeInfo.styleStatus.isDark = isDark
    KEEP.themeInfo.styleStatus.themePreference = SiteTheme.getPreference()
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon'
    if (button) {
      button.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式')
      button.setAttribute('aria-pressed', String(isDark))
    }
  })
  if (button && !button.hasClickListener) {
    button.setAttribute('role', 'button')
    button.setAttribute('tabindex', '0')
    const toggle = () => SiteTheme.setMode(SiteTheme.getMode() === 'dark' ? 'light' : 'dark')
    button.addEventListener('click', toggle)
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() }
    })
    button.hasClickListener = true
  }
}
