type SendSmsParams = {
  to: string
  message: string
  senderId?: string
}

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || 'datafast'
const ARKESEL_SMS_URL = process.env.ARKESEL_SMS_URL || 'https://sms.arkesel.com/api/v2/sms/send'

export async function sendSmsViaArkesel({ to, message, senderId }: SendSmsParams): Promise<{ ok: boolean; error?: string; response?: any }> {
  try {
    if (!ARKESEL_API_KEY) {
      console.error('SMS Error: Missing ARKESEL_API_KEY environment variable')
      return { ok: false, error: 'Missing ARKESEL_API_KEY' }
    }

    // Format phone number (remove leading 0 and add country code if needed)
    let formattedPhone = to.replace(/^0+/, '')
    if (!formattedPhone.startsWith('233')) {
      formattedPhone = `233${formattedPhone}`
    }

    // Try different payload formats based on Arkesel API version
    // Format 1: Standard format
    const payload = {
      sender: senderId || ARKESEL_SENDER_ID,
      message,
      recipients: [formattedPhone],
    }

    console.log('Sending SMS via Arkesel:', { 
      url: ARKESEL_SMS_URL,
      original: to, 
      formatted: formattedPhone, 
      sender: payload.sender, 
      messageLength: message.length,
      messagePreview: message.substring(0, 50) + '...',
      payload
    })

    const res = await fetch(ARKESEL_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': ARKESEL_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const responseData = await res.json().catch(async () => {
      const text = await res.text().catch(() => '')
      return { error: text || 'Unknown error' }
    })

    if (!res.ok) {
      console.error('Arkesel SMS Error:', { 
        status: res.status, 
        statusText: res.statusText,
        response: responseData 
      })
      return { 
        ok: false, 
        error: `Arkesel error: ${res.status} ${JSON.stringify(responseData)}`, 
        response: responseData 
      }
    }

    console.log('SMS sent successfully:', responseData)
    return { ok: true, response: responseData }
  } catch (e: any) {
    console.error('SMS Exception:', e)
    return { ok: false, error: e?.message || 'SMS send failed' }
  }
}


