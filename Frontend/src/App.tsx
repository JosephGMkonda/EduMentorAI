import {
BrowserRouter,
Routes,
Route,
Navigate
} from "react-router-dom";


import MainLayout from "./components/layouts/MainLayout";
import LessonPage from "./pages/LessonPage";
import HomePage from "./pages/HomePage";
import { ThemeProvider } from "./components/hooks/useTheme";


function App(){


return (

<ThemeProvider>

<BrowserRouter>


<MainLayout>


<Routes>


<Route
path="/"
element={<HomePage/>}
/>

<Route
path="/lesson/:topic"
element={<LessonPage/>}
/>

<Route
path="*"
element={<Navigate to="/" replace />}
/>


</Routes>


</MainLayout>


</BrowserRouter>

</ThemeProvider>

)

}


export default App;