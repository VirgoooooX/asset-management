import { config } from './config.js'
import { createApp } from './http/app.js'

const app = await createApp()

app.listen(config.port, () => {
  process.stdout.write(`api listening on :${config.port}\n`)
})

