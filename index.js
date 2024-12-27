// ------------------------
//         IMPORTS
// ------------------------

const express = require('express')
const chalk = require('chalk')
const figlet = require('figlet')
const gradient = require('gradient-string')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const inquirer = require('inquirer')

// ------------------------
//      EXPRESS SERVER
// ------------------------

const app = express()
const port = 3000
let listening = false
let running = false

// Middleware to validate authorization key
const validateAuthorization = (req, res, next) => {
  const keys = JSON.parse(fs.readFileSync('keys.json'))
  const uploadKey = req.headers['Authorization']
  const index = keys.findIndex(key => key.key === uploadKey)
  function validateAuthorizationUses(uses) { if (uses === -1) return true; else if (uses > 0) return true; else return false; }
  if (index !== -1 && validateAuthorizationUses(keys[index].uses)) {
    if (keys[index].uses !== -1) {
      keys[index].uses -= 1
      fs.writeFileSync('keys.json', JSON.stringify(keys))
    }
    next()
  } else {
    res.status(401).send('Unauthorized')
  }
}

// Middleware to set up static file server
app.use(express.static('source'))

// Multer configuration
const storage = multer.diskStorage({
  destination: 'storage/files/',
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

// Multer middleware
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 35 } }) // Limit file size to 35MB

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/source/index.html')
})

// File list route, returns a list of files
app.get('/files', (req, res) => {
  const storage = fs.readdirSync('storage').filter(file => file !== 'files').filter(file => file !== 'inventory.json')
  let files = []
  storage.forEach(file => {
    const data = JSON.parse(fs.readFileSync('storage/' + file))
    files.push({
      name: data.name,
      addedBy: data.addedBy,
      downloads: data.downloads.length
    })
  })
  res.json(files)
})

// Upload route, requires a valid authorization key and accepts multiple files and returns a success message
app.post('/upload', validateAuthorization, upload.array('files', 5), (req, res) => {
  req.files.forEach(file => {
    const keys = JSON.parse(fs.readFileSync('keys.json'))
    const data = {  
      'name': file.originalname,
      'addedBy': keys.find(key => key.key === req.headers['Authorization']).user,
      'downloads': []
    }
    fs.writeFileSync('storage/' + file.originalname + '.json', JSON.stringify(data))
    const inventory = JSON.parse(fs.readFileSync('storage/inventory.json'))
    inventory.push(file.originalname)
    fs.writeFileSync('storage/inventory.json', JSON.stringify(inventory))
  })
  res.status(200).json({
    message: 'Files uploaded successfully',
    files: req.files
  })
})

// Download route
app.get('/download', (req, res) => {
  const data = JSON.parse(fs.readFileSync('storage/' + req.query.file + '.json'))
  const download = {
    'ip': req.ip,
    'timestamp': Date.now(),
    'userAgent': req.headers['user-agent'],
  }
  data.downloads.push(download)
  fs.writeFileSync('storage/' + req.query.file + '.json', JSON.stringify(data))
  res.download('storage/files/' + req.query.file)
})

app.get('/info', (req, res) => {
  // Spoof Authorization header as query parameter
  if (req.query.key) {
    req.headers['Authorization'] = req.query.key
  }
  // Validate the key
  validateAuthorization(req, res, () => {
    const data = JSON.parse(fs.readFileSync('storage/' + req.query.file + '.json'))
    data.downloadLink = `${req.hostname}/download?file=${req.query.file}`
    res.json(data)
  })
})

// -------------------------
//     MENUS AND PROMPTS
// -------------------------

// Function to display title
function title(text) {
  console.clear()
  console.log(gradient.fruit(figlet.textSync('RatLocker', { font: 'Slant' })) + '\n', chalk.redBright(text), '\n')
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

function updateNewFiles() {
  // Load files and inventory
  const files = fs.readdirSync('storage/files')
  const inventory = JSON.parse(fs.readFileSync('storage/inventory.json'))
  files.forEach(file => {
    if (!inventory.includes(file)) {
      // Add file to inventory
      inventory.push(file)
      fs.writeFileSync('storage/inventory.json', JSON.stringify(inventory))
      // Add file data to storage
      const data = {
        name: file,
        addedBy: 'admin',
        downloads: []
      }
      fs.writeFileSync('storage/' + file + '.json', JSON.stringify(data))
    }
  })
}

function manageKeys() {
  title('Key Manager - RatLocker by ratwithaface')

  // Display keys and information
  let keys = JSON.parse(fs.readFileSync('keys.json'))
  keys.forEach(key => {
    console.log(chalk.cyan(`${key.key}`), chalk.blueBright(`${key.user}`), chalk.blue(`${key.uses}`))
  })
  console.log('\n')
  // Prompt user to create or delete keys
  inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [ 'Create Key', 'Delete Key', 'Back' ]
  }]).then((answers) => {
    switch (answers.action) {
      case 'Create Key':
        // Prompt user for details to create a new authorization key
        inquirer.prompt([{
          type: 'input',
          name: 'key',
          message: 'Enter the new Authorization Key:',
          default: crypto.randomUUID() // Generate a random UUID for authorization key
        }, {
          type: 'input',
          name: 'user',
          message: 'Enter the user associated with the new Authorization Key:',
        }, {
          type: 'number',
          name: 'uses',
          message: 'Enter the number of uses for the new Authorization Key (-1 for unlimited):',
          default: -1
        }]).then((answers) => {
          // Add new authorization key to keys.json
          keys.push(answers)
          fs.writeFileSync('keys.json', JSON.stringify(keys))
          manageKeys()
        })
        break
      case 'Delete Key':
        inquirer.prompt([{
          type: 'list',
          name: 'key',
          message: 'Select a key to delete:',
          choices: keys.map(key => key.key)
        }]).then((answers) => {
          // Delete authorization key from keys.json
          keys = keys.filter(key => key.key !== answers.key)
          fs.writeFileSync('keys.json', JSON.stringify(keys))
          manageKeys()
        })
        break
      case 'Back':
        main()
        break
    }
  })
}

// File manager menu
function manageFiles() {
  title('File Manager - RatLocker by ratwithaface')
  inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [ 'Add Files', 'Delete Files', 'Back' ]
  }]).then((answers) => {
    switch (answers.action) {
      case 'Add Files':

        // Open file explorer
        const filesPath = path.join(__dirname, 'storage', 'files')
        if (process.platform === 'win32') {
          runCommand(`explorer.exe ${filesPath}`)
        } else if ( process.platform === 'darwin' ) {
          runCommand(`open ${filesPath}`)
        }

        // Prompt user to add files
        console.log(chalk.bgBlue('\n File explorer has been opened. Please add files to /storage/files.\n'))
        setTimeout(() => {
          inquirer.prompt([{
            type: 'list',
            name: 'finished',
            message: 'Are you finished adding files? (Press ENTER when done)',
            choices: [ 'Yes, I am finished.' ]
          }]).then(() => {
            // Update inventory
            updateNewFiles()
            manageFiles()
          })
        }, 3000)
        break
      case 'Delete Files':
        function deleteFiles() {
          // Collect file names
          const files = fs.readdirSync('storage/files')
          let choices = []
          files.forEach(file => {
            choices.push({
              name: `${file} - ${JSON.parse(fs.readFileSync('storage/' + file + '.json')).addedBy}`,
              value: file
            })
          })
          choices.push('Back')
          
          // Prompt user to delete files
          inquirer.prompt([{
            type: 'list',
            name: 'file',
            message: 'Select a file to delete:',
            choices
          }]).then((answers) => {
            if ( answers.file === 'Back' ) {
              manageFiles()
            } else {
              // Delete file from storage
              fs.unlinkSync('storage/files/' + answers.file)
              fs.unlinkSync('storage/' + answers.file + '.json')

              // Update inventory
              const inventory = JSON.parse(fs.readFileSync('storage/inventory.json'))
              inventory.splice(inventory.indexOf(answers.file), 1)
              fs.writeFileSync('storage/inventory.json', JSON.stringify(inventory))

              deleteFiles()
            }
          })
        }
        deleteFiles()
        break
      case 'Back':
        main()
        break
    }
  })
}

// Function to run the server
function runServer() {
  listening = true
  app.listen(port, () => {
    main(`${chalk.greenBright(` Success!`)} ${chalk.yellow(`Server running on http://localhost:${port}`)}`)
  })
}

// Function to check for updates
function checkForUpdates() {
  console.log(chalk.yellow('Checking for updates...'))

  // Fetch latest changes from the remote repository
  runCommand('git fetch origin')

  // Compare local and remote branches
  const localHash = runCommand('git rev-parse HEAD')
  const remoteHash = runCommand('git rev-parse origin/master')

  // If local and remote hashes are different, return true
  if (localHash !== remoteHash) {
    return true
  } else {
    return false
  }
}

function main(message) {
  // Check for updates if first time running main()
  if (!running) {
    running = true
    if (checkForUpdates()) {
      title('A simple file hoster - created by ratwithaface')
      console.log(`${chalk.bgRedBright('New updates found!')} ${chalk.red('Run "npm run update" to update.')}`)
    } else {
      title('A simple file hoster - created by ratwithaface')
    }
  } else {
    title('A simple file hoster - created by ratwithaface')
  }

  // Display message if provided
  if (message) console.log(message, '\n')
  
  // Display options
  let choices = [ 'Manage Files', 'Manage Keys', 'Exit' ]
  if (!listening) choices.unshift('Run Server')
  inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices
    }
  ]).then((answers) => {
    switch (answers.action) {
      case 'Manage Keys':
        manageKeys()
        break
      case 'Manage Files':
        manageFiles()
        break
      case 'Exit':
        process.exit(0)
        break
      case 'Run Server':
        runServer()
        break
    }
  })
}

// Run the main function
JSON.parse(fs.readFileSync('keys.json')).length === 0 ? main(chalk.bgRed('No keys found. Please create one.')) : main()
