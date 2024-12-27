const { execSync } = require('child_process')
const chalk = require('chalk')
const figlet = require('figlet')
const gradient = require('gradient-string')

function title(text) {
  console.clear()
  console.log(gradient.fruit(figlet.textSync('RatLocker', { font: 'Slant' })) + '\n', chalk.redBright(text))
}

// Function to run shell commands
function runCommand(command) {
    try {
        return execSync(command, { stdio: 'pipe', encoding: 'utf-8' }).trim()
    } catch (error) {
        console.error(`Error executing command: ${command}`)
        console.error(error.message)
        process.exit(1)
    }
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
        console.log('New updates found. Pulling changes...')
        runCommand('git pull origin master')
        console.log('RatLocker updated successfully!')
    } else {
        console.log('No updates available.')
    }
}

checkForUpdates()