# Levante Survey Manager

A comprehensive Vue.js application for managing and creating surveys for the Levante research platform. This application provides a visual interface for accessing surveys from Google Cloud Storage and creating new surveys using SurveyJS Creator.

## 🚀 Features

- **📋 Survey Management**: Browse and manage surveys from Google Cloud Storage
- **🎨 Visual Survey Creator**: Create and edit surveys using SurveyJS Creator
- **🌐 Multi-language Support**: Built-in support for English, Spanish, and German
- **📱 Responsive Design**: Modern UI with PrimeVue components
- **☁️ Cloud Integration**: Direct integration with Levante GCS bucket
- **⚡ Real-time Preview**: Preview surveys before publishing
- **🔧 TypeScript**: Full TypeScript support for better development experience

## 🏗️ Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **UI Library**: PrimeVue 4 with Aura theme
- **Survey Engine**: SurveyJS (Core + Creator + Vue3 UI)
- **State Management**: Pinia with persistence
- **Routing**: Vue Router 4
- **HTTP Client**: Axios
- **Styling**: CSS3 with modern gradients and animations

## 📦 Installation

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- npm or yarn package manager

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/levante-framework/levante-surveys.git
   cd levante-surveys
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional):
   ```bash
   # Create .env file
   VITE_FIREBASE_PROJECT=DEV  # or PROD
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   Navigate to `http://localhost:5173`

## 🎯 Usage

### Dashboard
- Overview of all available surveys
- Quick stats on loaded surveys and errors
- Direct access to survey creation and management

### Survey List
- Browse all surveys from the GCS bucket
- View survey metadata and statistics
- Quick preview and edit actions

### Survey Creator
- Visual drag-and-drop survey builder
- Multiple question types (text, choice, rating, etc.)
- Logic and branching support
- Multi-language survey creation
- JSON export/import functionality

### Survey Preview
- Live preview of surveys before publishing
- Test survey flow and validation
- Mobile and desktop responsive testing

## 🗂️ Project Structure

```
src/
├── components/          # Reusable Vue components
├── views/              # Page-level components
│   ├── DashboardView.vue
│   ├── SurveyListView.vue
│   ├── SurveyDetailView.vue
│   ├── SurveyPreviewView.vue
│   └── SurveyCreatorView.vue
├── stores/             # Pinia stores
│   └── survey.ts       # Survey state management
├── helpers/            # Utility functions
│   └── surveyLoader.ts # GCS survey loading
├── constants/          # App constants
│   └── bucket.ts       # GCS bucket configuration
├── router/             # Vue Router configuration
├── assets/             # Static assets
└── main.ts            # App entry point
```

## 📡 API Integration

### Google Cloud Storage

The application integrates with Google Cloud Storage buckets:

- **Development**: `levante-dashboard-dev`
- **Production**: `road-dashboard`

### Available Surveys

- `parent_survey_family.json` - Family questionnaire
- `parent_survey_child.json` - Child-specific survey
- `child_survey.json` - Student survey
- `teacher_survey_general.json` - General teacher survey
- `teacher_survey_classroom.json` - Classroom-specific survey

### Survey Loading

```typescript
import { loadSurveyFromBucket } from '@/helpers/surveyLoader'

// Load a specific survey
const response = await loadSurveyFromBucket('PARENT_FAMILY')
console.log(response.data) // Survey JSON data
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Variables

- `VITE_FIREBASE_PROJECT` - Set to 'DEV' or 'PROD' to determine GCS bucket

### Adding New Surveys

1. Add survey file to the appropriate GCS bucket
2. Update `SURVEY_FILES` constant in `src/constants/bucket.ts`
3. Add type mapping in `formatSurveyType` function

## 🎨 Customization

### Themes
The application uses PrimeVue's Aura theme with custom CSS variables. Modify theme in `src/main.ts`:

```typescript
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      // Custom theme options
    }
  }
})
```

### Survey Creator Options
Customize SurveyJS Creator in `src/views/SurveyCreatorView.vue`:

```typescript
const options = {
  showLogicTab: true,
  showTranslationTab: true,
  showJSONEditorTab: true,
  // ... other options
}
```

## 🌍 Multi-language Support

The application supports extracting text from multilingual survey objects:

```json
{
  "title": {
    "en": "English Title",
    "es": "Título en Español",
    "de": "Deutscher Titel"
  }
}
```

Use the `extractText` helper to get language-specific content:

```typescript
import { extractText } from '@/helpers/surveyLoader'

const title = extractText(survey.title, 'es') // Gets Spanish title
```

## 🧪 Testing

### Running the Application

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Test survey loading from the dashboard
4. Create a new survey using the creator
5. Preview surveys before saving

### Manual Testing Checklist

- [ ] Dashboard loads with correct survey stats
- [ ] Survey list displays all available surveys
- [ ] Survey creator initializes properly
- [ ] Survey preview works correctly
- [ ] Multi-language text extraction works
- [ ] Responsive design on mobile/desktop

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deploy to Static Hosting

The application can be deployed to any static hosting service:

- **Netlify**: Connect to GitHub repository
- **Vercel**: Import project from Git
- **Firebase Hosting**: Use Firebase CLI
- **GitHub Pages**: Use GitHub Actions

### Environment Configuration

Make sure to set the correct environment variables for production:

```bash
VITE_FIREBASE_PROJECT=PROD
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Commit your changes: `git commit -m 'Add new feature'`
5. Push to the branch: `git push origin feature/new-feature`
6. Submit a pull request

### Development Guidelines

- Use TypeScript for all new code
- Follow Vue 3 Composition API patterns
- Use PrimeVue components when possible
- Maintain responsive design principles
- Add proper error handling and loading states

## 📝 License

This project is part of the Levante research platform. Please contact the Levante team for licensing information.

## 🆘 Support

For questions and support:

- Create an issue in this repository
- Contact the Levante development team
- Refer to the [SurveyJS documentation](https://surveyjs.io/documentation/) for survey-specific questions

## 🔗 Related Projects

- [levante-dashboard](https://github.com/levante-framework/levante-dashboard) - Main Levante platform
- [SurveyJS](https://surveyjs.io/) - Survey library and creator
- [PrimeVue](https://primevue.org/) - Vue.js UI component library

---

**Built with ❤️ for the Levante research platform**
