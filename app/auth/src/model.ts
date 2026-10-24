interface User {
    id: number
}

interface Keys {
    id: number
    user_id: number
    api_key: number
}

interface Sessions {
    id: number
    user_id: number
    token: string
}