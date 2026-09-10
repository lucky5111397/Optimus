/**
 * Formats a user record into a safe profile presentation object.
 *
 * @param {Object} user - User record from repository or database
 * @returns {Object|null} Formatted user profile
 */
function formatUserProfile(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  // BUG: Direct unchecked property chaining throws TypeError when metadata or preferences is null or undefined
  return {
    id: user.id,
    displayName: (user.name || '').trim(),
    theme: user.metadata.preferences.theme || 'dark',
    notificationsEnabled: !!user.metadata.preferences.notifications,
    tags: (user.metadata.tags || []).slice(0, 5)
  };
}

module.exports = { formatUserProfile };
