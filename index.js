const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');

async function run() {
  try {
    const token = core.getInput('token');
    const defaultVersion = core.getInput('default_version');

    await exec.exec('git', ['fetch', '--tags']);
    const { stdout: latestTag } = await exec.getExecOutput('git', ['describe', '--tags', '--abbrev=0']);
    
    let versionFromPackageJson = '';
    let versionFromFile = '';

    // Read version from package.json
    try {
      versionFromPackageJson = require('./package.json').version;
    } catch (err) {
      core.info('No package.json found, skipping version read from it.');
    }

    // Read version from .version file
    try {
      versionFromFile = fs.readFileSync('.version', 'utf8').trim();
    } catch (err) {
      core.info('No .version file found, skipping version read from it.');
    }

    const latest = latestTag.trim() || versionFromPackageJson || versionFromFile || defaultVersion;

    // Determine version bump from PR title
    const prTitle = process.env.GITHUB_REF; // You might want to set this according to your context
    let bump = 'none';

    if (/^feat!:/i.test(prTitle) || /^fix!:/i.test(prTitle) || /^BREAKING CHANGE/i.test(prTitle)) {
      bump = 'major';
    } else if (/^feat:/i.test(prTitle)) {
      bump = 'minor';
    } else if (/^fix:/i.test(prTitle)) {
      bump = 'patch';
    }

    if (bump !== 'none') {
      const [major, minor, patch] = latest.replace(/^v/, '').split('.').map(Number);
      let newVersion;

      switch (bump) {
        case 'major':
          newVersion = `v${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `v${major}.${minor + 1}.0`;
          break;
        case 'patch':
          newVersion = `v${major}.${minor}.${patch + 1}`;
          break;
      }

      await exec.exec('git', ['config', 'user.name', 'GitHub Actions']);
      await exec.exec('git', ['config', 'user.email', 'actions@github.com']);
      await exec.exec('git', ['tag', '-a', newVersion, '-m', `Release ${newVersion}`]);
      await exec.exec('git', ['push', 'origin', newVersion]);

      core.setOutput('new_version', newVersion);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
