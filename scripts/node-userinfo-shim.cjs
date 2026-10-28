// Windows CI/workspace runners can fail uv_os_get_passwd before tests load.
// Preserve the native result when available and provide only the minimum
// deterministic process-account metadata needed by TypeScript loaders.
const os = require('node:os');
const nativeUserInfo = os.userInfo;
os.userInfo = (...args) => {
  try {
    return nativeUserInfo(...args);
  } catch (error) {
    if (!error || error.code !== 'ERR_SYSTEM_ERROR') throw error;
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'openpolici-runner',
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: null
    };
  }
};
