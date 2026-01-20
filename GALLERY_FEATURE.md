# Gallery Feature Documentation

## Overview

The Gallery feature allows users to save and manage their t-shirt designs using Supabase authentication and database storage.

## Features Implemented

### 1. User Authentication
- **Email/Password Sign Up**: Users can create accounts with email and password
- **Email/Password Sign In**: Existing users can sign in
- **Session Management**: Automatic session persistence and token refresh
- **User Profile**: Automatic profile creation on signup

### 2. Design Gallery
- **Save Designs**: Users can save their complete t-shirt design state
- **View Gallery**: Display all saved designs in a grid layout
- **Load Designs**: Restore previous designs with all settings
- **Delete Designs**: Remove unwanted designs from the gallery
- **Design Metadata**: Each design includes title, creation date, and thumbnail

### 3. Files Created

#### Database Schema (`supabase_schema.sql`)
- `profiles` table: User profiles linked to auth.users
- `gallery` table: Stores saved t-shirt designs
- Row Level Security (RLS) policies
- Automatic triggers for profile creation and updated_at timestamps

#### Services
- `src/lib/supabase.ts`: Supabase client configuration
- `src/services/authService.ts`: Authentication functions
- `src/services/galleryService.ts`: Gallery operations (save, load, delete)

#### Components
- `src/components/Auth/SignIn.tsx`: Sign in/sign up form
- `src/components/Auth/SignIn.css`: Styling for auth component
- `src/components/Gallery/Gallery.tsx`: Gallery display and management
- `src/components/Gallery/Gallery.css`: Styling for gallery

#### Integration
- `src/App.tsx`: Added routes for `/signin` and `/gallery`
- `src/pages/Customize.tsx`: Added "Save" button for authenticated users

### 4. Routes Added
- `/signin` - Authentication page (sign in/sign up)
- `/gallery` - Gallery page to view and manage saved designs

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-react
```

### 2. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key from Settings → API

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run Database Schema
1. In Supabase dashboard, go to SQL Editor
2. Copy contents of `supabase_schema.sql`
3. Paste and run in SQL Editor
4. This will create tables, policies, and triggers

### 5. Configure Authentication
1. In Supabase dashboard, go to Authentication → Settings
2. Set Site URL: `http://localhost:5173` (for development)
3. Add redirect URL: `http://localhost:5173/**`

## Usage

### For Users

1. **Sign Up**
   - Navigate to `/signin`
   - Click "Sign Up" if not in signup mode
   - Enter email and password
   - Enter optional full name
   - Submit to create account

2. **Sign In**
   - Navigate to `/signin`
   - Enter email and password
   - Click "Sign In"

3. **Save a Design**
   - Create your t-shirt design in `/customize`
   - Click the "💾 Save" button (only visible when signed in)
   - Enter a title for your design
   - Design is saved to your gallery

4. **View Gallery**
   - Navigate to `/gallery`
   - View all your saved designs in a grid
   - Each design shows:
     - Title
     - Creation date
     - Thumbnail (if available)

5. **Load a Design**
   - In the gallery, click "Load" on any design
   - The design state will be restored
   - All settings (gender, measurements, colors, etc.) are restored

6. **Delete a Design**
   - In the gallery, click "Delete" on any design
   - Confirm deletion
   - Design is permanently removed

7. **Sign Out**
   - Click "Sign Out" in the gallery
   - Session is cleared

## Data Structure

### Design Data Exported
When a design is saved, the following data is stored:

```typescript
{
  gender: 'male' | 'female',
  preset: 'slim' | 'average' | 'plus',
  bodyType: 'ectomorph' | 'endomorph' | 'mesomorph',
  bodyTypeIntensity: number,
  heightScale: number,
  measurements: {
    heightCm: number,
    chestCm: number,
    waistCm: number,
    shouldersCm: number,
    sleeveCm: number
  },
  garment: {
    preset: 'S' | 'M' | 'L' | 'XL',
    style: 'fit' | 'regular' | 'loose',
    custom?: { widthIn, lengthIn, sleeveIn }
  },
  baseColor: string,
  skinColor: string,
  layers: Array<Layer> // Design layers from the design page
}
```

### Database Schema
- **profiles**: User profile information
- **gallery**: Stored designs with design_data (JSONB), title, thumbnail_url, timestamps

## Security

- **Row Level Security (RLS)**: Users can only access their own data
- **Authentication**: All gallery operations require authentication
- **Data Validation**: Input validation on both client and server side
- **Session Management**: Automatic token refresh and secure session storage

## Future Enhancements

Possible additions to the gallery feature:

1. **Thumbnails**: Generate and store actual design previews
2. **Sharing**: Allow users to share designs with others
3. **Export**: Direct export to images/PDF from gallery
4. **Collections**: Organize designs into folders/categories
5. **Search**: Search designs by title or tags
6. **Duplicate**: Clone existing designs as starting point
7. **Stats**: Show design count, favorites, etc.

## Troubleshooting

### Can't sign up
- Check Supabase configuration in `.env`
- Verify email provider is enabled in Supabase dashboard
- Check browser console for errors

### Can't save designs
- Ensure you're signed in
- Check Supabase database tables were created
- Verify RLS policies are active

### Gallery is empty
- Make sure you've saved at least one design
- Check you're signed in with the correct account
- Verify database connection in Supabase dashboard

## API Reference

### authService
- `signUp(email, password, fullName?)`: Create new user account
- `signIn(email, password)`: Sign in existing user
- `signOut()`: Sign out current user
- `getSession()`: Get current session
- `getCurrentUser()`: Get current user object
- `onAuthStateChange(callback)`: Listen for auth state changes

### galleryService
- `saveDesign(designData, title, thumbnailUrl?)`: Save a design
- `getMyDesigns()`: Get all designs for current user
- `getDesignById(id)`: Get a specific design
- `updateDesign(id, updates)`: Update a design
- `deleteDesign(id)`: Delete a design
- `exportDesignData(store)`: Export design state from store
- `loadDesignData(store, savedData)`: Load design state into store

