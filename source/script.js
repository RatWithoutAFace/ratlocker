document.getElementById('uploadForm').addEventListener('submit', (event) => {
  console.log('Form submitted')
  event.preventDefault()
  const keyInput = document.getElementById('uploadKeyInput')
  const fileInput = document.getElementById('fileUpload')
  

  // Create form data
  const formData = new FormData()
  for (let i = 0; i < fileInput.files.length; i++) {
    formData.append('files', fileInput.files[i])
  }
  
  // Upload files
  fetch('/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'upload-key': keyInput.value
    }
  })
  .then(response => {
    if (!response.ok) {
      if (response.status === 401) {
        alert('401 Unauthorized')
      }
      throw new Error('Error uploading files')
    } else {
      console.log('Files uploaded successfully')
      return response.json()
    }
  })
  .then(data => {
    console.log(data)
  })
  .catch(error => {
    console.error(error)
  })

  // Close modal
  const modalElement = document.getElementById('uploadModal')
  const modal = bootstrap.Modal.getInstance(modalElement)
  modal.hide()

  // Reset form
  keyInput.value = ''
  fileInput.files = []

  loadFiles()
})
    
// Load files from server
async function loadFiles() {
  const response = await fetch('/files')
  if (!response.ok) {
    console.error('Error fetching files:', response.statusText)
    throw new Error('Error fetching files')
  }
    
  const files = await response.json()
  
  // Add files to table
  const table = document.getElementById('files')
  table.childNodes.forEach(child => child.remove())
  files.forEach(file => {
    const fileRow = document.createElement('tr')
    const fileName = document.createElement('td')
    const addedBy = document.createElement('td')
    const downloads = document.createElement('td')
    const downloadButton = document.createElement('td')
    fileName.textContent = file.name
    addedBy.textContent = file.addedBy
    const downloadLink = document.createElement('a')
    downloadLink.href = `/download?file=${file.name}`
    downloadLink.textContent = 'Download'
    downloads.textContent = file.downloads
    downloadButton.appendChild(downloadLink)
    fileRow.appendChild(fileName)
    fileRow.appendChild(addedBy)
    fileRow.appendChild(downloadButton)
    fileRow.appendChild(downloads)
    table.appendChild(fileRow)
  })
}

loadFiles()