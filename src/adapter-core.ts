export function appendQueryStringParameters(parameters: string, url: string){
    if(!parameters) return url;

    let separator: string;

    if(url.endsWith("?")){
        separator = "";
    }
    else if(url.includes("?")){
        separator = "&";
    }
    else{
        separator = "?";
    }

    return url + separator + parameters;
}