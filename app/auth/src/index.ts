import {serve} from '@hono/node-server'
import {Hono} from 'hono'

const app = new Hono()

app.get('/health', (c) => {
    return c.json({
        'status': 'ok'
    })
})

// 颁发 token
app.post('/v1/tokens', (c) => {
    return c.json({
        'status': 'ok'
    })
})

// 颁发 api key
app.post('v1/keys', (c) => {
    return c.json({
        'status': 'ok'
    })
})

// 撤销 api key
app.delete('/v1/keys', (c) => {
    return c.json({
        'name': '撤销 api key'
    })
})

app.get('/v1/keys', (c) => {
    return c.json({
        'name': '获取 api key list'
    })
})

serve({
    fetch: app.fetch, port: 3000
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
})
