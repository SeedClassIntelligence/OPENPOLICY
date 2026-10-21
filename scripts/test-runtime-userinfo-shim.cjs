// Windows test-host compatibility: tsx asks Node for os.userInfo() while
// creating its temporary directory. Some managed Windows hosts return
// ERR_SYSTEM_ERROR before application code starts. Keep production runtime
// untouched and provide only the same stable identity data Node would expose.
const os = require('node:os');

const originalUserInfo = os.userInfo;
os.userInfo = function userInfoWithManagedHostFallback(options) {
  try {
    return originalUserInfo(options);
  } catch (error) {
    if (!error || (error.code !== 'ERR_SYSTEM_ERROR' && error.code !== 'ENOMEM')) {
      throw error;
    }
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'codex-test-host',
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: null,
    };
  }
};
