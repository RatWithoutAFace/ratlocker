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
const { exec } = require('child_process')
const inquirer = require('inquirer')
const { fileURLToPath } = require('url')
const { json } = require('stream/consumers')

// ------------------------
//      EXPRESS SERVER
// ------------------------

const app = express()
const port = 3000
let listening = false

// Middleware to validate upload key
const validateUploadKey = (req, res, next) => {
  const keys = JSON.parse(fs.readFileSync('keys.json'))
  const uploadKey = req.headers['upload-key']
  const index = keys.findIndex(key => key.key === uploadKey)
  function validateUploadKeyUses(uses) { if (uses === -1) return true; else if (uses > 0) return true; else return false; }
  if (index !== -1 && validateUploadKeyUses(keys[index].uses)) {
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
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 35 } })

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

// Upload route, requires a valid upload key and accepts multiple files and returns a success message
app.post('/upload', validateUploadKey, upload.array('files', 5), (req, res) => {
  req.files.forEach(file => {
    const keys = JSON.parse(fs.readFileSync('keys.json'))
    const data = {  
      'name': file.originalname,
      'addedBy': keys.find(key => key.key === req.headers['upload-key']).user,
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

// -------------------------
//     MENUS AND PROMPTS
// -------------------------

function title(text) {
  console.clear()
  console.log(gradient.fruit(figlet.textSync('RatLocker', { font: 'Slant' })) + '\n', chalk.redBright(text), '\n')
}

function updateNewFiles() {
  const files = fs.readdirSync('storage/files')
  const inventory = JSON.parse(fs.readFileSync('storage/inventory.json'))
  files.forEach(file => {
    if (!inventory.includes(file)) {
      inventory.push(file)
      fs.writeFileSync('storage/inventory.json', JSON.stringify(inventory))
      const data = {
        name: file,
        addedBy: 'admin',
        downloads: []
      }
      fs.writeFileSync('storage/' + file + '.json', JSON.stringify(data))
    }
  })
}

function manageUploadKeys() {
  title('Upload Key Manager - RatLocker by ratwithaface')
  let keys = JSON.parse(fs.readFileSync('keys.json'))
  keys.forEach(key => {
    console.log(chalk.yellowBright(`${key.key}`), chalk.greenBright(`${key.user}`), chalk.redBright(`${key.uses}`))
  })
  inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [ 'Create Upload Key', 'Delete Upload Key', 'Back' ]
  }]).then((answers) => {
    switch (answers.action) {
      case 'Create Upload Key':
        inquirer.prompt([{
          type: 'input',
          name: 'key',
          message: 'Enter the new upload key:',
          default: crypto.randomUUID()
        }, {
          type: 'input',
          name: 'user',
          message: 'Enter the user associated with the new upload key:',
        }, {
          type: 'number',
          name: 'uses',
          message: 'Enter the number of uses for the new upload key (-1 for unlimited):',
          default: -1
        }]).then((answers) => {
          keys.push(answers)
          fs.writeFileSync('keys.json', JSON.stringify(keys))
          manageUploadKeys()
        })
        break
      case 'Delete Upload Key':
        inquirer.prompt([{
          type: 'list',
          name: 'key',
          message: 'Select a key to delete:',
          choices: keys.map(key => key.key)
        }]).then((answers) => {
          keys = keys.filter(key => key.key !== answers.key)
          fs.writeFileSync('keys.json', JSON.stringify(keys))
          manageUploadKeys()
        })
        break
      case 'Back':
        main()
        break
    }
  })
}

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
        const filesPath = path.join(__dirname, 'storage', 'files')
        if (process.platform === 'win32') {
          exec(`explorer.exe ${filesPath}`)
        } else if ( process.platform === 'darwin' ) {
          exec(`open ${filesPath}`)
        }
        console.log(chalk.bgBlue('\n File explorer has been opened. Please add files to /storage/files.\n'))
        setTimeout(() => {
          inquirer.prompt([{
            type: 'list',
            name: 'finished',
            message: 'Are you finished adding files?',
            choices: [ 'Yes, I am finished.' ]
          }]).then((answers) => {
            updateNewFiles()
            manageFiles()
          })
        }, 3000)
        break
      case 'Delete Files':
        function deleteFiles() {
          const files = fs.readdirSync('storage/files')
          let choices = []
          files.forEach(file => {
            choices.push({
              name: `${file} - ${JSON.parse(fs.readFileSync('storage/' + file + '.json')).addedBy}`,
              value: file
            })
          })
          choices.push('Back')
          inquirer.prompt([{
            type: 'list',
            name: 'file',
            message: 'Select a file to delete:',
            choices
          }]).then((answers) => {
            if ( answers.file === 'Back' ) {
              manageFiles()
            } else {
              fs.unlinkSync('storage/files/' + answers.file)
              fs.unlinkSync('storage/' + answers.file + '.json')

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

function runServer() {
  listening = true
  app.listen(port, () => {
    main(`${chalk.greenBright(` Success!`)} ${chalk.yellow(`Server running on http://localhost:${port}`)}`)
  })
}

function exit() { console.clear(); console.log(chalk.greenBright('Goodbye!')); process.exit() }

function main(message) {
  title('A simple file hoster - created by ratwithaface')
  if (message) console.log(message, '\n')
  let choices = [ 'Manage Files', 'Manage Upload Keys', 'Exit' ]
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
      case 'Manage Upload Keys':
        manageUploadKeys()
        break
      case 'Manage Files':
        manageFiles()
        break
      case 'Exit':
        exit()
        break
      case 'Run Server':
        runServer()
        break
    }
  })
}

JSON.parse(fs.readFileSync('keys.json')).length === 0 ? main(chalk.bgRed('No upload keys found. Please create one.')) : main()
