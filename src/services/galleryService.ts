/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase'

// Helper function to upload image to Supabase Storage
async function uploadImageToStorage(imageDataUrl: string, fileName: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Convert data URL to blob
    const response = await fetch(imageDataUrl)
    const blob = await response.blob()
    const file = new File([blob], fileName, { type: 'image/png' })

    // Upload to Supabase Storage
    const filePath = `${user.id}/${fileName}`
    const { error } = await supabase.storage
      .from('gallery')
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.error('Error uploading image:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('gallery')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error in uploadImageToStorage:', error)
    return null
  }
}

export const galleryService = {
  // Save a t-shirt design to the gallery with optional thumbnail
  async saveDesign(designData: any, title: string = 'Untitled Design', thumbnailDataUrl?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    let thumbnailUrl: string | undefined = undefined

    // Upload thumbnail to storage if provided
    if (thumbnailDataUrl) {
      const fileName = `thumbnail-${Date.now()}.png`
      const uploadedUrl = await uploadImageToStorage(thumbnailDataUrl, fileName)
      if (uploadedUrl) {
        thumbnailUrl = uploadedUrl
      }
    }

    const { data, error } = await supabase
      .from('gallery')
      .insert({
        user_id: user.id,
        design_data: designData,
        title,
        thumbnail_url: thumbnailUrl,
      })
      .select()
      .single()

    return { data, error }
  },

  // Get all designs for the current user
  async getMyDesigns() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  // Get a specific design by ID
  async getDesignById(id: string) {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  },

  // Update a design
  async updateDesign(id: string, updates: { title?: string; design_data?: any; thumbnail_url?: string }) {
    const { data, error } = await supabase
      .from('gallery')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  // Delete a design
  async deleteDesign(id: string) {
    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('id', id)

    return { error }
  },

  // Delete all designs for the current user
  async deleteAllMyDesigns() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: { message: 'User not authenticated' } }
    }

    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('user_id', user.id)

    return { error }
  },

  // Delete a thumbnail from storage
  async deleteThumbnail(filePath: string) {
    const { error } = await supabase.storage
      .from('gallery')
      .remove([filePath])
    
    return { error }
  },

  // Share a design - generates a share token and makes it publicly viewable
  async shareDesign(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Check if design belongs to user
    const { data: design, error: fetchError } = await supabase
      .from('gallery')
      .select('id, user_id, share_token, is_shared')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !design) {
      return { data: null, error: { message: 'Design not found or access denied' } }
    }

    // Generate share token if doesn't exist
    let shareToken = design.share_token
    if (!shareToken) {
      // Generate a random token
      const randomBytes = crypto.getRandomValues(new Uint8Array(16))
      shareToken = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
    }

    // Update design to be shared
    const { data: updated, error } = await supabase
      .from('gallery')
      .update({ 
        is_shared: true, 
        share_token: shareToken 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    // Generate share URL
    const shareUrl = `${window.location.origin}/shared/${shareToken}`
    
    return { data: { ...updated, shareUrl }, error: null }
  },

  // Unshare a design
  async unshareDesign(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('gallery')
      .update({ is_shared: false })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    return { data, error }
  },

  // Get a shared design by share token (public access, no auth required)
  async getSharedDesign(shareToken: string) {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_shared', true)
      .single()

    return { data, error }
  },
}

// Helper function to capture scene as thumbnail
export function captureSceneThumbnail(sceneCanvas: HTMLCanvasElement | null): string | null {
  if (!sceneCanvas) return null
  
  try {
    // Create a canvas for the thumbnail (smaller size)
    const thumbnailCanvas = document.createElement('canvas')
    const ctx = thumbnailCanvas.getContext('2d')
    if (!ctx) return null
    
    // Set thumbnail dimensions (you can adjust these)
    thumbnailCanvas.width = 512
    thumbnailCanvas.height = 512
    
    // Draw the scene canvas scaled to thumbnail size
    ctx.drawImage(sceneCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)
    
    // Convert to data URL
    return thumbnailCanvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error capturing thumbnail:', error)
    return null
  }
}

// Helper function to export design data from the store
export function exportDesignData(designStore: any) {
  return {
    gender: designStore.gender,
    preset: designStore.preset,
    bodyType: designStore.bodyType,
    bodyTypeIntensity: designStore.bodyTypeIntensity,
    heightScale: designStore.heightScale,
    measurements: designStore.measurements,
    garment: designStore.garment,
    baseColor: designStore.baseColor,
    skinColor: designStore.skinColor,
    layers: designStore.layers,
  }
}

// Helper function to load design data into the store
export async function loadDesignData(designStore: any, savedData: any) {
  console.log('📥 Loading design data:', savedData)
  
  // Clear existing layers first
  designStore.clearLayers()
  
  // Load all settings
  if (savedData.gender) {
    console.log('Setting gender:', savedData.gender)
    designStore.setGender(savedData.gender)
  }
  if (savedData.preset) designStore.setPreset(savedData.preset)
  if (savedData.bodyType) {
    console.log('Setting body type:', savedData.bodyType)
    designStore.setBodyType(savedData.bodyType)
  }
  if (savedData.bodyTypeIntensity !== undefined) {
    console.log('Setting body type intensity:', savedData.bodyTypeIntensity)
    designStore.setBodyTypeIntensity(savedData.bodyTypeIntensity)
  }
  if (savedData.heightScale !== undefined) designStore.setHeightScale(savedData.heightScale)
  if (savedData.measurements) {
    console.log('Setting measurements:', savedData.measurements)
    designStore.setMeasurements(savedData.measurements)
  }
  if (savedData.garment) {
    console.log('Setting garment:', savedData.garment)
    designStore.setGarment(savedData.garment)
  }
  if (savedData.baseColor) designStore.setBaseColor(savedData.baseColor)
  if (savedData.skinColor) designStore.setSkinColor(savedData.skinColor)
  
  // Load layers one by one
  if (savedData.layers && Array.isArray(savedData.layers)) {
    console.log('Loading layers:', savedData.layers.length)
    savedData.layers.forEach((layer: any) => {
      designStore.addLayer(layer)
    })
  }
  
  console.log('✅ Design data loaded successfully')
}

