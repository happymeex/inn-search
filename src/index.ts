const searchForm = document.querySelector("#search-form") as HTMLFormElement;

interface SearchFormData {
    input: string;
    caseSensitivity: boolean;
}

searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(searchForm);
    const data = Object.fromEntries(formData);
    console.log(data);
});
