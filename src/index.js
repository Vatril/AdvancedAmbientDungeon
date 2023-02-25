import React from "react"
import ReactDOM from "react-dom/client"
import { client } from "./client"
import { ApolloProvider } from "@apollo/client"
import "./index.css"
import "typeface-roboto"
import { App } from "./App"
import { TagApp } from "./TagApp"

const root = ReactDOM.createRoot(document.getElementById("root"))

root.render(
    <React.StrictMode>
        <ApolloProvider client={client}>
            {window.location.href.includes("/tag") ? <TagApp /> : <App />}
        </ApolloProvider>
    </React.StrictMode>,
)
