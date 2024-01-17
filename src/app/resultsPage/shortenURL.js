import logger from '../../logger'

const shortenURL = (url, tinyURLAPIKey) => {
    return fetch('https://api.tinyurl.com/create', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${tinyURLAPIKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: url,
            domain: 'tinyurl.com',
            description: 'string',
        }),
    })
        .then(async (response) => {
            const json = await response.json()
            if (json?.data?.tiny_url) {
                return json.data.tiny_url
            }

            logger.error('Unable to shorten URL, no URL found in response')

            logger.debug(response.data)
            return url
        })
        .catch((error) => {
            logger.debug(error)

            logger.error(
                `Unable to shorten URL code=${error.code || error.message}`,
            )

            return url
        })
}

export default shortenURL
