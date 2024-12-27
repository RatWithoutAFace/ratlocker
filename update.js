const { execSync } = require('child_process')
const chalk = require('chalk')
const figlet = require('figlet')
const gradient = require('gradient-string')

function title(text) {
  console.clear()
  console.log(gradient.fruit(figlet.textSync('RatLocker', { font: 'Slant' })) + '\n', chalk.redBright(text))
}

// Function to run shell commands
function runCommand(command, allowFailure = false) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch (error) {
    if (allowFailure) return null
    console.error(`Error executing command: ${command}`)
    console.error(error.message)
    process.exit(1)
  }
}

// Function to resolve conflicts automatically
function resolveConflicts() {
  console.log(chalk.yellow('Resolving conflicts...'))
  const status = runCommand('git status --porcelain', true)

  if (!status) {
    console.log(chalk.green('No conflicts detected.'))
    return
  }

  const conflictFiles = status
    .split('\n')
    .filter(line => line.startsWith('UU') || line.startsWith('DU') || line.startsWith('UD'))
    .map(line => line.split(' ').pop())

  if (conflictFiles.length === 0) {
    console.log(chalk.green('No conflicts detected.'))
    return
  }

  console.log(chalk.yellow(`Conflicted files: ${conflictFiles.join(', ')}`))
  
  conflictFiles.forEach(file => {
    console.log(chalk.yellow(`Resolving conflict for: ${file}`))
    runCommand(`git checkout --ours ${file}`, true) // Use "--ours" to keep local changes; change to "--theirs" for remote changes
    runCommand(`git add ${file}`, true)
  })

  runCommand('git commit -m "Resolved merge conflicts automatically"', true)
  console.log(chalk.green('Conflicts resolved and committed.'))
}

// Function to check for updates
function checkForUpdates() {
  title('')
  console.log('Checking for updates...')

  // Fetch latest changes from the remote repository
  runCommand('git fetch origin')

  // Compare local and remote branches
  const localHash = runCommand('git rev-parse HEAD')
  const remoteHash = runCommand('git rev-parse origin/master')

  if (localHash !== remoteHash) {
    console.log('New updates found. Stashing changes...')
    runCommand('git stash', true)

    console.log('Pulling changes...')
    runCommand('git pull origin master')

    console.log('Attempting to reapply stashed changes...')
    const stashResult = runCommand('git stash pop', true)

    if (stashResult && stashResult.includes('CONFLICT')) {
      resolveConflicts()
    }

    console.log('RatLocker updated successfully!')
  } else {
    console.log('No updates available.')
  }
}

checkForUpdates()